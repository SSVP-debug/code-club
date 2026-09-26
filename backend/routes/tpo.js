import { Router } from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import { logger } from "../config/logger.js";
import User from "../models/User.js";
import { B2B_ENABLED, B2B_BILLING_ENABLED, B2B_PRICING } from "../config/featureFlags.js";
import Assignment from "../models/Assignment.js";
import Cohort from "../models/Cohort.js";
import CohortMembership from "../models/CohortMembership.js";
import { createRequire } from "module";
import { requireRole } from "../middleware/roleGuard.js";
import College from "../models/College.js";
import { SITE_URL, SUPPORT_EMAIL } from "../config/site.js";
import { requireVerified } from "../middleware/requireVerified.js";
import { getOrSetCache } from "../utils/cache.js";
import { invalidateTpoCache } from "../controllers/tpoController.js";
import { createNotification, createNotificationBulk } from "../services/notificationService.js";
import { isDomainAutoVerified, isConsumerEmailDomain } from "../utils/domainVerification.js";
import { looksLikeEmailAddress } from "../utils/collegeNameHeuristics.js";
import { getSettings } from "../services/settingsService.js";
import {
  getCollegeForTpo,
  isPrimaryTpo,
  listTeam,
  claimPrimaryIfNone,
  transferPrimary,
  resolveTpoTeamContext,
  resolveCollegeDomains,
} from "../services/tpoTeamService.js";
import { invalidateCachedUserByFirebaseUid } from "../utils/userAuthCache.js";
import * as cohortService from "../services/cohortService.js";
import * as cohortMembershipService from "../services/cohortMembershipService.js";
import * as cohortImportService from "../services/cohortImportService.js";
import { getInstitutionReportOverview } from "../services/institutionReportService.js";
import { getActiveCohortStudentIds, getCohortBreakdown } from "../services/cohortDashboardService.js";
import { computeReadinessScore } from "../utils/readiness.js";
import multer from "multer";
import { csvUpload } from "../middleware/csvUpload.js";
import { getInstitutionSubscription } from "../services/institutionSubscriptionService.js";
import { buildTpoVerificationSignal, classifyInstitutionalEmailRole } from "../services/tpoRoleSignalService.js";

const TPO_CACHE_TTL_SECONDS = 2 * 60; // 2 minutes — matches profile cache TTL
const TPO_CACHE_PREFIX = "tpo:";

const require = createRequire(import.meta.url);


const router = Router();

// Full-college scans (/students, /dashboard) are the most expensive queries
// in this file — every request re-reads every student row for the domain.
// Cached per-domain via the shared Redis-backed helper so multiple Railway
// instances agree, same pattern as leaderboard.js.


function b2bGate(req, res) {
  if (!B2B_ENABLED) {
    res.status(200).json({
      enabled: false,
      message: `College dashboard is not live yet. Reach out to ${SUPPORT_EMAIL} for early access.`,
    });
    return true;
  }
  return false;
}

// Plan 009: gates NEW TPO registrations only — never blocks an existing
// TPO from logging in or using any other /api/tpo route (b2bGate above
// already runs first anyway; this only ever runs inside /register).
// Exported for direct unit testing, same pattern as this file's own
// handleRemindAssignment.
export async function tpoRegistrationGate(req, res) {
  const settings = await getSettings();
  if (settings.tpoRegistrationEnabled === false) {
    res.status(403).json({
      error: "TPO registration is temporarily disabled. Please check back later.",
    });
    return true;
  }
  return false;
}

// ── POST /api/tpo/register ──────────────────────────────────────────────────
// A regular user converts their account into a TPO account.
// In practice: a separate signup page asks for college name + verifies the
// email domain matches an institutional domain (not gmail.com etc).
router.post("/register", async (req, res) => {
  if (b2bGate(req, res)) return;
  if (await tpoRegistrationGate(req, res)) return;

  try {
    const { collegeName } = req.body;
    if (!req.userDoc) return res.status(503).json({ error: "Database unavailable." });
    if (!collegeName) return res.status(400).json({ error: "collegeName is required." });

    if (looksLikeEmailAddress(collegeName)) {
      return res.status(400).json({
        error: "That looks like an email address — please enter your college's name instead.",
      });
    }

    const email = req.userDoc.email || "";
    const domain = email.split("@")[1]?.toLowerCase().trim();
    if (!domain || isConsumerEmailDomain(domain)) {
      return res.status(400).json({
        error: "Please sign in with your institutional email (e.g. yourname@college.ac.in), not a personal email.",
      });
    }

    const existingCollege = await College.findByDomain(domain);
    const existingIsAutoPlaceholder = existingCollege?.submittedByRole === "auto";

    if (existingCollege && existingCollege.status !== "verified" && !existingIsAutoPlaceholder) {
      return res.status(409).json({
        error: "This college is already registered and pending verification.",
        status: existingCollege.status,
      });
    }

    const autoVerified =
      (existingCollege?.status === "verified" && !existingIsAutoPlaceholder) ||
      (await isDomainAutoVerified(domain, "college"));

    const now = new Date();
    let collegeDoc = existingCollege;
    let createdNewCollege = false;
    let placeholderSnapshot = null;

    if (!existingCollege) {
      collegeDoc = await College.create({
        domains: [domain],
        name: collegeName.trim(),
        status: autoVerified ? "verified" : "pending",
        verifiedAt: autoVerified ? now : null,
        submittedBy: req.userDoc._id,
        submittedByRole: "tpo",
      });
      createdNewCollege = true;
    } else if (existingIsAutoPlaceholder) {
      placeholderSnapshot = {
        name: existingCollege.name,
        status: existingCollege.status,
        verifiedAt: existingCollege.verifiedAt,
        submittedBy: existingCollege.submittedBy,
        submittedByRole: existingCollege.submittedByRole,
      };
      existingCollege.name = collegeName.trim();
      existingCollege.status = autoVerified ? "verified" : "pending";
      existingCollege.verifiedAt = autoVerified ? now : null;
      existingCollege.submittedBy = req.userDoc._id;
      existingCollege.submittedByRole = "tpo";
      await existingCollege.save();
    }

    const signal = buildTpoVerificationSignal(email, collegeDoc);
    const emailRoleClassification = signal.result;

    req.userDoc.grantRole("tpo");
    req.userDoc.role = "tpo";
    req.userDoc.tpoProfile = {
      collegeDomain: domain,
      collegeName: collegeName.trim(),
      verified: autoVerified,
      requestedAt: now,
      verifiedAt: autoVerified ? now : null,
    };
    req.userDoc.tpoVerification = {
      status: autoVerified ? "approved" : "pending",
      emailRoleSignal: emailRoleClassification,
      submittedEmail: email,
      submittedAt: now,
      evidence: [
        {
          kind: "email",
          label: "Institutional sign-in email",
          note: "Email ownership is established by the authenticated sign-in provider; role classification remains advisory.",
          addedAt: now,
        },
      ],
    };

    try {
      await req.userDoc.save();
    } catch (err) {
      if (createdNewCollege) {
        await College.deleteOne({ _id: collegeDoc._id }).catch((rollbackErr) =>
          (req.log || logger).error(
            { err: rollbackErr, collegeId: collegeDoc._id },
            "[TPO] register: failed to roll back newly-created College"
          )
        );
      } else if (placeholderSnapshot) {
        await College.updateOne(
          { _id: collegeDoc._id },
          { $set: placeholderSnapshot }
        ).catch((rollbackErr) =>
          (req.log || logger).error(
            { err: rollbackErr, collegeId: collegeDoc._id },
            "[TPO] register: failed to roll back placeholder College"
          )
        );
      }
      throw err;
    }

    let isPrimary = false;
    if (autoVerified && collegeDoc) {
      try {
        isPrimary = await claimPrimaryIfNone(collegeDoc._id, req.userDoc._id);
      } catch (err) {
        (req.log || logger).error(
          { err, collegeId: collegeDoc._id, userId: req.userDoc._id },
          "[TPO] register: primary claim failed after successful registration"
        );
      }
    }

    return res.status(201).json({
      success: true,
      role: "tpo",
      verified: autoVerified,
      status: autoVerified ? "verified" : "pending",
      isPrimary,
      emailRoleSignal: emailRoleClassification,
      verification: {
        status: autoVerified ? "approved" : "pending",
        additionalEvidenceRecommended:
          emailRoleClassification !== "staff_candidate",
      },
      message: autoVerified
        ? "Your college is verified. You're all set — head to your dashboard."
        : "Your college registration request has been submitted for verification.",
    });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] register error");
    return res.status(500).json({ error: "Failed to register as TPO." });
  }
});

// ── TPO-6 entitlement enforcement ─────────────────────────────────────────
// Registration and billing-status must remain reachable without a paid plan.
// Students using the college TPO directory are also unaffected because this
// router serves that student route as well. Admins retain platform-wide access.
export async function requireInstitutionSubscription(req, res, next) {
  if (!B2B_BILLING_ENABLED) return next();
  if (req.userDoc?.role === "admin" || req.userDoc?.role === "student") return next();
  if (req.path.startsWith("/billing/")) return next();

  try {
    const college = await getCollegeForTpo(req.userDoc);
    if (!college) {
      return res.status(404).json({
        error: "Your TPO account is not linked to a verified college.",
        code: "INSTITUTION_NOT_FOUND",
      });
    }

    if (!getInstitutionSubscription(college).isActive) {
      return res.status(402).json({
        error: "Your institution needs an active Code Club subscription.",
        code: "INSTITUTION_SUBSCRIPTION_REQUIRED",
        collegeId: college._id,
      });
    }

    return next();
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] institution entitlement check failed");
    return res.status(500).json({ error: "Failed to verify institution subscription." });
  }
}

// Apply entitlement enforcement after registration so a new TPO can
// register/request approval before an institution has a paid plan.
router.use(requireInstitutionSubscription);

// ── TPO-6 Batch 2 — institutional checkout ────────────────────────────────
function getRazorpayClient() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  try {
    const Razorpay = require("razorpay");
    return new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  } catch {
    return null;
  }
}

async function resolvePayingCollege(req, res) {
  const college = await getCollegeForTpo(req.userDoc);
  if (!college) {
    res.status(404).json({ error: "Your TPO account is not linked to a verified college." });
    return null;
  }
  if (college.status !== "verified") {
    res.status(403).json({ error: "Your college must be verified before purchasing an institution plan." });
    return null;
  }
  if (!isPrimaryTpo(college, req.userDoc._id)) {
    res.status(403).json({ error: "Only the primary TPO can manage the institution subscription." });
    return null;
  }
  return college;
}

router.get("/billing/plans", requireRole("tpo", "admin"), requireVerified, (req, res) => {
  if (b2bGate(req, res)) return;
  return res.json({
    enabled: B2B_BILLING_ENABLED,
    currency: "INR",
    plans: Object.entries(B2B_PRICING).map(([id, plan]) => ({
      id,
      label: plan.label,
      amountRupees: plan.amountPaise / 100,
      interval: plan.interval,
      durationDays: plan.durationDays,
    })),
  });
});

router.post("/billing/create-order", requireRole("tpo"), requireVerified, async (req, res) => {
  if (b2bGate(req, res)) return;
  if (!B2B_BILLING_ENABLED) {
    return res.status(409).json({ error: "Institution billing is not live yet." });
  }

  try {
    const college = await resolvePayingCollege(req, res);
    if (!college) return;

    const plan = B2B_PRICING[req.body?.planId];
    if (!plan) return res.status(400).json({ error: "Invalid institution plan ID." });

    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return res.status(503).json({
        error: "Payment provider not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      });
    }

    const order = await razorpay.orders.create({
      amount: plan.amountPaise,
      currency: "INR",
      receipt: `cc_college_${college._id}_${Date.now()}`,
      notes: {
        collegeId: college._id.toString(),
        planId: req.body.planId,
        purchaserUserId: req.userDoc._id.toString(),
        billingType: "institution",
      },
    });

    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      planId: req.body.planId,
      collegeId: college._id,
    });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] institution create-order error");
    return res.status(500).json({ error: "Failed to create institution payment order." });
  }
});

router.post("/billing/verify", requireRole("tpo"), requireVerified, async (req, res) => {
  if (b2bGate(req, res)) return;
  if (!B2B_BILLING_ENABLED) {
    return res.status(409).json({ error: "Institution billing is not live yet." });
  }

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
    } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planId) {
      return res.status(400).json({ error: "Missing payment verification fields." });
    }

    const plan = B2B_PRICING[planId];
    if (!plan) return res.status(400).json({ error: "Invalid institution plan ID." });

    const college = await resolvePayingCollege(req, res);
    if (!college) return;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const receivedBuffer = Buffer.from(String(razorpay_signature), "utf8");
    const signaturesMatch =
      expectedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    if (!signaturesMatch) {
      return res.status(400).json({ error: "Payment verification failed. Signature mismatch." });
    }

    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return res.status(503).json({ error: "Payment provider not configured." });
    }

    const order = await razorpay.orders.fetch(razorpay_order_id);
    const orderNotes = order?.notes || {};
    if (
      orderNotes.billingType !== "institution" ||
      orderNotes.collegeId !== college._id.toString() ||
      orderNotes.purchaserUserId !== req.userDoc._id.toString() ||
      orderNotes.planId !== planId ||
      Number(order.amount) !== Number(plan.amountPaise) ||
      order.currency !== "INR"
    ) {
      return res.status(400).json({ error: "Payment order does not match this institution purchase." });
    }

    if (college.subscription?.providerPaymentId === razorpay_payment_id) {
      return res.json({
        success: true,
        collegeId: college._id,
        plan: college.subscription.plan,
        expiresAt: college.subscription.expiresAt,
        alreadyProcessed: true,
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    college.subscription = {
      ...college.subscription?.toObject?.(),
      plan: planId,
      status: "active",
      startedAt: now,
      expiresAt,
      cancelledAt: null,
      provider: "razorpay",
      providerCustomerId: college.subscription?.providerCustomerId || null,
      providerOrderId: razorpay_order_id,
      providerPaymentId: razorpay_payment_id,
      providerSubscriptionId: null,
      lastPaymentAt: now,
    };
    await college.save();

    return res.json({
      success: true,
      collegeId: college._id,
      plan: planId,
      expiresAt,
    });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] institution verify error");
    return res.status(500).json({ error: "Institution payment verification failed." });
  }
});

// ── GET /api/tpo/billing/status ────────────────────────────────────────────
// Institution billing is intentionally separate from individual student
// subscriptions. A TPO can inspect the college entitlement without seeing
// provider secrets or payment identifiers.
router.get("/billing/status", requireRole("tpo", "admin"), requireVerified, async (req, res) => {
  if (b2bGate(req, res)) return;

  try {
    const college = req.userDoc.role === "admin"
      ? (req.query.collegeId ? await College.findById(req.query.collegeId).lean() : null)
      : await getCollegeForTpo(req.userDoc);

    if (req.userDoc.role === "admin" && !req.query.collegeId) {
      return res.status(400).json({ error: "collegeId is required." });
    }
    if (!college) return res.status(404).json({ error: "College not found." });

    const subscription = getInstitutionSubscription(college);
    const isPrimary = req.userDoc.role === "admin"
      ? true
      : isPrimaryTpo(college, req.userDoc._id);
    const now = Date.now();
    const expiresAtMs = subscription.expiresAt ? new Date(subscription.expiresAt).getTime() : null;
    const daysRemaining = expiresAtMs && expiresAtMs > now
      ? Math.ceil((expiresAtMs - now) / (24 * 60 * 60 * 1000))
      : 0;

    return res.json({
      billingEnabled: B2B_BILLING_ENABLED,
      collegeId: college._id,
      collegeName: college.name,
      isPrimary,
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        startedAt: subscription.startedAt,
        expiresAt: subscription.expiresAt,
        cancelledAt: subscription.cancelledAt,
        provider: subscription.provider,
        isActive: subscription.isActive,
        daysRemaining,
        renewalRequired: !subscription.isActive || daysRemaining <= 7,
      },
    });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] billing status error");
    return res.status(500).json({ error: "Failed to load institution billing status." });
  }
});

router.post("/billing/cancel", requireRole("tpo"), requireVerified, async (req, res) => {
  if (b2bGate(req, res)) return;
  if (!B2B_BILLING_ENABLED) {
    return res.status(409).json({ error: "Institution billing is not live yet." });
  }

  try {
    const college = await resolvePayingCollege(req, res);
    if (!college) return;

    const subscription = getInstitutionSubscription(college);
    if (!subscription.isActive) {
      return res.status(409).json({ error: "There is no active institution subscription to cancel." });
    }

    college.subscription.status = "cancelled";
    college.subscription.cancelledAt = new Date();
    // Cancellation stops future renewal but preserves the already-paid period.
    await college.save();

    return res.json({
      success: true,
      status: "cancelled",
      expiresAt: college.subscription.expiresAt,
      message: "Institution subscription cancelled. Access remains active until the paid period ends.",
    });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] institution cancel error");
    return res.status(500).json({ error: "Failed to cancel institution subscription." });
  }
});

// ── GET /api/tpo/me ──────────────────────────────────────────────────────────
// isPrimary/teamCount added (Phase 3, item 17) — the minimum institutional
// identity info the TPO dashboard needs to show "you are/aren't the
// primary TPO" and a team-size hint without a separate round trip.
router.get("/me", requireRole("tpo", "admin"),
  requireVerified, async (req, res) => {
    if (b2bGate(req, res)) return;

    const college = await getCollegeForTpo(req.userDoc);

    return res.json({
      collegeName: req.userDoc.tpoProfile?.collegeName,
      collegeDomain: req.userDoc.tpoProfile?.collegeDomain,
      email: req.userDoc.email,
      isPrimary: college ? isPrimaryTpo(college, req.userDoc._id) : false,
      hasPrimary: Boolean(college?.primaryTpo),
    });
  });


// ── GET /api/tpo/college-directory ─────────────────────────────────────────
// Student-facing directory of verified TPOs for the student's own college.
// The client never supplies a collegeId: institution is resolved from the
// student's verified college linkage, preventing cross-college enumeration.
router.get("/college-directory", requireRole("student"), async (req, res) => {
  if (b2bGate(req, res)) return;

  try {
    const education = req.userDoc.education || {};
    if (!education.emailVerified) {
      return res.status(403).json({ error: "Verify your college email to view your college TPO directory." });
    }

    let college = null;
    if (education.collegeId) {
      college = await College.findById(education.collegeId).lean();
    }

    if (!college && req.userDoc.emailDomain) {
      college = await College.findOne({
        domains: req.userDoc.emailDomain.toLowerCase(),
        status: "verified",
      }).lean();
    }

    if (!college || college.status !== "verified") {
      return res.status(404).json({ error: "Your college is not linked to a verified institution yet." });
    }

    const members = await User.find({
      role: "tpo",
      status: "active",
      "tpoProfile.collegeDomain": { $in: college.domains },
      "tpoProfile.verified": true,
    })
      .select("_id displayName email tpoProfile.collegeName")
      .sort({ displayName: 1, email: 1 })
      .lean();

    return res.json({
      college: { id: college._id, name: college.name },
      tpos: members.map((member) => ({
        id: member._id,
        name: member.displayName || "TPO",
        email: member.email,
        collegeName: member.tpoProfile?.collegeName || college.name,
        isPrimary: college.primaryTpo?.toString() === member._id.toString(),
      })),
    });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] college directory error");
    return res.status(500).json({ error: "Failed to load your college TPO directory." });
  }
});

// ── TPO TEAM MANAGEMENT (Phase 3) ───────────────────────────────────────────
// GET  /api/tpo/team                      — list this college's TPO team
// POST /api/tpo/team/invite                — primary adds an existing account
// DELETE /api/tpo/team/:tpoId              — primary removes a team member
// POST /api/tpo/team/:tpoId/make-primary   — primary transfers primary status
//
// All four require a verified TPO (requireVerified) on top of requireRole,
// same as every other TPO route in this file — a pending TPO can't manage
// institutional membership (invariant #5). The three mutating ones
// additionally require the caller to BE the primary TPO for their own
// college (resolveTpoInstitution + requirePrimaryOnly below) — a secondary TPO can view the
// team but not act on it (permission matrix, item 4).

// Resolves the College doc a team request should act on and, for the
// three mutating routes, confirms the caller is authorized on it (its
// primary TPO, or an admin) before calling through. Stashes the resolved
// college on req.tpoCollege so handlers don't re-query it — cheap here
// since TPO team size is always small (item 27), but no reason to ask
// twice in the same request.
//
// TPO-1 closure fix: this used to resolve the college purely from the
// caller's OWN tpoProfile.collegeDomain (getCollegeForTpo), which always
// returns null for an admin account (admins have no tpoProfile) — so
// every admin request to these routes 400'd before it could even be
// authorized, contradicting the required permission matrix ("Invite TPO
// / Remove TPO / Transfer primary — Admin: YES"). Now routes through
// resolveTpoTeamContext, which lets an admin name the college explicitly
// via collegeId — see that function's own comment for why a non-admin
// caller's collegeId is never consulted (cross-college isolation).
// Resolves req.tpoCollege (the caller's own institution, or — for an
// admin only — an explicitly supplied collegeId) and stashes
// req.tpoIsAdmin alongside it. No primary-only gate here — this is the
// shared base every institution-scoped TPO route needs (team management
// AND, as of TPO-2 Step 4, cohort management), split out from what used
// to be requirePrimaryTeamAction's single combined middleware so cohort
// routes can reuse the institution-resolution half without inheriting
// team-management's primary-only restriction (TPO-2 Step 4's explicit
// product decision: cohort management is an operational workflow, not
// an authority-transfer action — every verified TPO, primary or
// secondary, can use it). This is the "smallest reusable extension" of
// the TPO-1 hardening rather than a second, competing authorization
// implementation.
async function resolveTpoInstitution(req, res, next) {
  try {
    const explicitCollegeId = req.body?.collegeId || req.query?.collegeId;
    const { college, isAdmin, missingCollegeId } = await resolveTpoTeamContext(req.userDoc, explicitCollegeId);

    if (missingCollegeId) {
      return res.status(400).json({ error: "collegeId is required." });
    }
    if (!college) {
      return res.status(400).json({
        error: isAdmin ? "College not found." : "No college found for this TPO account.",
      });
    }
    req.tpoCollege = college;
    req.tpoIsAdmin = isAdmin;
    next();
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] resolveTpoInstitution error");
    return res.status(500).json({ error: "Failed to resolve TPO institution." });
  }
}

// Layers the primary-only gate on top of resolveTpoInstitution — for
// TPO-team authority actions specifically (invite/remove/transfer
// primary). Must run AFTER resolveTpoInstitution in a route's
// middleware chain (relies on req.tpoCollege/req.tpoIsAdmin already
// being set).
function requirePrimaryOnly(req, res, next) {
  if (!req.tpoIsAdmin && !isPrimaryTpo(req.tpoCollege, req.userDoc._id)) {
    return res.status(403).json({ error: "Only the primary TPO can manage the TPO team." });
  }
  next();
}

router.get("/team", requireRole("tpo", "admin"), requireVerified, resolveTpoInstitution, async (req, res) => {
  if (b2bGate(req, res)) return;

  try {
    const college = req.tpoCollege;
    const isAdmin = req.tpoIsAdmin;

    const members = await listTeam(college);

    return res.json({
      collegeName: college.name,
      domain: isAdmin ? college.domains[0] : req.userDoc.tpoProfile?.collegeDomain,
      primaryTpoId: college.primaryTpo ? college.primaryTpo.toString() : null,
      team: members.map((m) => ({
        id: m._id.toString(),
        name: m.displayName,
        email: m.email,
        isPrimary: isPrimaryTpo(college, m._id),
        verified: Boolean(m.tpoProfile?.verified),
        requestedAt: m.tpoProfile?.requestedAt,
        verifiedAt: m.tpoProfile?.verifiedAt,
        joinedDate: m.joinedDate,
      })),
    });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] team list error");
    return res.status(500).json({ error: "Failed to load TPO team." });
  }
});

// ── POST /api/tpo/team/invite ───────────────────────────────────────────────
// Adds an EXISTING Code Club account (found by email) as a verified
// secondary TPO on the primary's college. Deliberately does not create a
// new account or a separate invitation-token identity system (item 9) —
// the candidate must already have signed up (and therefore already gone
// through Firebase auth) before the primary can add them, mirroring the
// "candidate authenticates, then institution relationship established"
// flow the phase doc describes. This is the same instant-verification
// trust decision POST /register already makes for a second TPO registering
// on an already-verified college domain (see isDomainAutoVerified/
// existingCollege.status === "verified" above): a known institutional-
// domain account, vouched for by the college's own primary TPO, doesn't
// need a second manual admin review.
router.post("/team/invite", requireRole("tpo", "admin"), requireVerified, resolveTpoInstitution, requirePrimaryOnly, async (req, res) => {
  if (b2bGate(req, res)) return;

  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email is required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const domain = normalizedEmail.split("@")[1];
    const college = req.tpoCollege;

    // Cross-college protection: the invited email's domain must be one of
    // THIS college's own domains — a primary can never grant TPO authority
    // for a domain they don't represent (invariant #2).
    if (!domain || !college.domains.includes(domain)) {
      return res.status(400).json({
        error: `That email must belong to your institution's domain (${college.domains.join(", ")}).`,
      });
    }

    const target = await User.findOne({ email: normalizedEmail });
    if (!target) {
      return res.status(404).json({
        error: "No Code Club account exists for that email yet. They'll need to sign up first.",
      });
    }

    // Already on this team? Compare against every domain this college
    // owns, not just the inviting primary's own literal collegeDomain —
    // for a multi-domain college, a teammate who joined via a different
    // (but still legitimate) domain of the SAME institution must still be
    // recognized as already-a-member. Comparing against a single domain
    // string here previously let this fall through to the "add" path
    // below and silently re-issue/reset that teammate's tpoProfile
    // (requestedAt/verifiedAt) instead of correctly rejecting with 409.
    if (target.role === "tpo" && college.domains.includes(target.tpoProfile?.collegeDomain)) {
      return res.status(409).json({ error: "That person is already on your TPO team." });
    }
    // A TPO belongs to only one college at a time (invariant #1) — reject
    // rather than silently reassigning someone verified at another
    // institution.
    if (
      target.role === "tpo" &&
      target.tpoProfile?.verified &&
      target.tpoProfile?.collegeDomain &&
      !college.domains.includes(target.tpoProfile.collegeDomain)
    ) {
      return res.status(409).json({ error: "That person is already a verified TPO at a different institution." });
    }

    const now = new Date();
    target.grantRole("tpo");
    target.role = "tpo";
    target.tpoProfile = {
      // The domain the invited email actually belongs to, not the
      // inviting primary's own domain — for a multi-domain college these
      // can legitimately differ, and each TPO's tpoProfile should record
      // which literal domain THEY belong to (their own audit trail, and
      // what getCollegeForTpo/College.findByDomain resolve back from).
      collegeDomain: domain,
      collegeName: college.name,
      verified: true,
      requestedAt: now,
      verifiedAt: now,
    };
    await target.save();
    invalidateCachedUserByFirebaseUid(target.firebaseUid);

    createNotificationBulk([target._id], {
      type: "tpo_team_added",
      title: "You've been added as a TPO",
      message: `${college.name} added you as a secondary TPO on Code Club.`,
      link: "/tpo/dashboard",
    }).catch((err) => (req.log || logger).error({ err }, "[TPO] team invite notification failed"));

    return res.status(201).json({ success: true, id: target._id.toString(), name: target.displayName, email: target.email });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] team invite error");
    return res.status(500).json({ error: "Failed to add TPO." });
  }
});

// ── DELETE /api/tpo/team/:tpoId ─────────────────────────────────────────────
// Revokes TPO authority only — never deletes the account or touches any
// Student-track field (invariant #4). The primary cannot remove themself
// this way (item 10's "Primary removal" rule: transfer first, via
// POST /team/:tpoId/make-primary, then the now-secondary former primary can
// be removed like anyone else).
router.delete("/team/:tpoId", requireRole("tpo", "admin"), requireVerified, resolveTpoInstitution, requirePrimaryOnly, async (req, res) => {
  if (b2bGate(req, res)) return;

  try {
    const { tpoId } = req.params;
    const college = req.tpoCollege;

    if (tpoId === req.userDoc._id.toString()) {
      return res.status(400).json({
        error: "You can't remove yourself as primary TPO. Transfer primary status to someone else first.",
      });
    }
    // Defense in depth: even if tpoId somehow doesn't match the caller's
    // own id but does match college.primaryTpo (a stale-primary edge
    // case), never let a team-removal request strip primary authority
    // out from under the invariant — that must go through the transfer
    // endpoint, which keeps the "college always has 0/1 primary" CAS
    // intact end to end.
    if (college.primaryTpo && college.primaryTpo.toString() === tpoId) {
      return res.status(400).json({
        error: "Cannot remove the current primary TPO. Transfer primary status first.",
      });
    }

    const target = await User.findOne({
      _id: tpoId,
      role: "tpo",
      "tpoProfile.collegeDomain": { $in: college.domains },
    });
    if (!target) {
      return res.status(404).json({ error: "TPO not found on your team." });
    }

    // Preserve the Student role/data entirely — revokeRole only ever
    // touches `roles`/the active `role` fallback (see models/User.js), and
    // tpoProfile is the only thing reset below.
    const wasActiveTpo = target.role === "tpo";
    target.revokeRole("tpo");
    if (wasActiveTpo) target.role = "student";
    target.tpoProfile = {
      collegeDomain: null,
      collegeName: null,
      verified: false,
      requestedAt: null,
      verifiedAt: null,
    };
    await target.save();
    invalidateCachedUserByFirebaseUid(target.firebaseUid);

    createNotification({
      userId: target._id,
      type: "tpo_team_removed",
      title: "TPO access removed",
      message: `Your TPO access at ${college.name} has been removed. Your student account is unaffected.`,
      link: "/dashboard",
    }).catch((err) => (req.log || logger).error({ err }, "[TPO] team removal notification failed"));

    return res.json({ success: true });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] team removal error");
    return res.status(500).json({ error: "Failed to remove TPO." });
  }
});

// ── POST /api/tpo/team/:tpoId/make-primary ──────────────────────────────────
// Atomic primary transfer (item 11) — see tpoTeamService.js's
// transferPrimary for the CAS that guarantees exactly 0 or 1 primary TPO
// survives even under concurrent transfer attempts.
router.post("/team/:tpoId/make-primary", requireRole("tpo", "admin"), requireVerified, resolveTpoInstitution, requirePrimaryOnly, async (req, res) => {
  if (b2bGate(req, res)) return;

  try {
    const { tpoId } = req.params;
    const college = req.tpoCollege;

    if (tpoId === req.userDoc._id.toString()) {
      return res.status(400).json({ error: "You're already the primary TPO." });
    }

    const target = await User.findOne({
      _id: tpoId,
      role: "tpo",
      "tpoProfile.collegeDomain": { $in: college.domains },
      "tpoProfile.verified": true,
    });
    if (!target) {
      return res.status(404).json({ error: "Verified TPO not found on your team." });
    }

    const transferred = await transferPrimary(college._id, req.userDoc._id, target._id);
    if (!transferred) {
      return res.status(409).json({
        error: "Primary status changed since this page loaded. Refresh and try again.",
      });
    }

    createNotification({
      userId: target._id,
      type: "tpo_team_primary_transfer",
      title: "You're now the primary TPO",
      message: `${college.name} transferred primary TPO status to you.`,
      link: "/tpo/dashboard",
    }).catch((err) => (req.log || logger).error({ err }, "[TPO] primary transfer notification failed"));

    return res.json({ success: true, primaryTpoId: target._id.toString() });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] primary transfer error");
    return res.status(500).json({ error: "Failed to transfer primary TPO status." });
  }
});

// ── COHORT MANAGEMENT (TPO-2 Step 4) ────────────────────────────────────────
// GET    /api/tpo/cohorts                    — list this institution's cohorts
// POST   /api/tpo/cohorts                    — create a cohort
// GET    /api/tpo/cohorts/:cohortId          — cohort detail
// PATCH  /api/tpo/cohorts/:cohortId          — edit (name/year/branch/section/expectedHeadcount only)
// POST   /api/tpo/cohorts/:cohortId/archive  — archive (idempotent)
//
// Every route: requireRole → requireVerified → resolveTpoInstitution.
// Deliberately NO requirePrimaryOnly here — TPO-2 Step 4's explicit
// product decision is that cohort management is an operational
// institutional workflow, not an authority-transfer action, so both
// primary and secondary verified TPOs get identical access (unlike the
// team-management routes above, which do layer requirePrimaryOnly on
// top of the same resolveTpoInstitution base). Admin access reuses the
// exact same explicit-collegeId override resolveTpoInstitution already
// provides for team routes — no second admin pattern invented here.
//
// Business logic lives in services/cohortService.js, not inline here —
// same split this file already uses for team management
// (services/tpoTeamService.js) and the pattern adminController.js
// established for admin routes; these handlers stay thin: resolve →
// call the service → shape the HTTP response.
//
// Caching: deliberately NONE for cohort reads in this step. The
// existing TPO cache (getOrSetCache/invalidateCachePrefix, used by
// /students and /dashboard above) is keyed and invalidated per literal
// domain, driven by student-progress-change events
// (controllers/tpoController.js's invalidateTpoCache) — an entirely
// different invalidation trigger than "a TPO created/edited/archived a
// cohort." Wiring a new, correct invalidation path for a low-volume,
// cheaply-queried, per-institution collection (dozens of cohorts, not
// thousands of students) is exactly the kind of speculative caching
// infrastructure this step's instructions say to skip in favor of
// correctness — added here only if/when real traffic data justifies it.

router.get("/cohorts", requireRole("tpo", "admin"), requireVerified, resolveTpoInstitution, async (req, res) => {
  if (b2bGate(req, res)) return;

  try {
    const rawPage = parseInt(req.query.page, 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const rawLimit = parseInt(req.query.limit, 10);
    const limit = Math.min(
      COHORTS_MAX_PAGE_SIZE,
      Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : COHORTS_DEFAULT_PAGE_SIZE
    );

    // status: no default filter — an unfiltered list returns BOTH
    // active and archived cohorts (TPO-2 Step 4's "otherwise return
    // both statuses with an explicit status filter" branch — there's no
    // existing TPO UI/API precedent for a default-active convention to
    // match here). Any other value than the two real statuses is
    // ignored rather than erroring, same "malformed query param
    // shouldn't break the page" spirit as /students' page/limit
    // handling above.
    const status = ["active", "archived"].includes(req.query.status) ? req.query.status : undefined;

    const rawGradYear = parseInt(req.query.graduatingYear, 10);
    const graduatingYear = Number.isFinite(rawGradYear) ? rawGradYear : undefined;

    const branch = typeof req.query.branch === "string" && req.query.branch.trim() ? req.query.branch.trim() : undefined;
    const search = typeof req.query.search === "string" && req.query.search.trim() ? req.query.search.trim() : undefined;

    const result = await cohortService.listCohorts(req.tpoCollege._id, {
      status, graduatingYear, branch, search, page, limit,
    });

    return res.json(result);
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] cohort list error");
    return res.status(500).json({ error: "Failed to load cohorts." });
  }
});

router.post("/cohorts", requireRole("tpo", "admin"), requireVerified, resolveTpoInstitution, async (req, res) => {
  if (b2bGate(req, res)) return;

  try {
    // collegeId is never accepted from the client as authoritative —
    // resolveTpoInstitution already ignores it for a non-admin caller
    // when resolving req.tpoCollege; here we go one step further and
    // never even read req.body.collegeId at all when building the
    // document, so there is no code path where a client-supplied value
    // could end up stored, even by accident.
    const cohort = await cohortService.createCohort(req.tpoCollege._id, req.userDoc._id, req.body || {});
    return res.status(201).json(cohort);
  } catch (err) {
    if (cohortService.isCohortValidationError(err)) {
      return res.status(400).json({ error: cohortService.formatCohortValidationError(err) });
    }
    (req.log || logger).error({ err }, "[TPO] cohort create error");
    return res.status(500).json({ error: "Failed to create cohort." });
  }
});

router.get("/cohorts/:cohortId", requireRole("tpo", "admin"), requireVerified, resolveTpoInstitution, async (req, res) => {
  if (b2bGate(req, res)) return;

  try {
    const result = await cohortService.getCohortForCollege(req.params.cohortId, req.tpoCollege._id);
    if (result?.invalidId) {
      return res.status(400).json({ error: "Invalid cohort ID." });
    }
    // A nonexistent cohort and a cohort belonging to another
    // institution both resolve to the same `null` here and the same
    // 404 — deliberately indistinguishable, so a cross-college probe
    // learns nothing about whether the id exists at all.
    if (!result) {
      return res.status(404).json({ error: "Cohort not found." });
    }
    return res.json(result);
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] cohort get error");
    return res.status(500).json({ error: "Failed to load cohort." });
  }
});

router.patch("/cohorts/:cohortId", requireRole("tpo", "admin"), requireVerified, resolveTpoInstitution, async (req, res) => {
  if (b2bGate(req, res)) return;

  try {
    const result = await cohortService.updateCohort(req.params.cohortId, req.tpoCollege._id, req.body || {});
    if (result?.invalidId) {
      return res.status(400).json({ error: "Invalid cohort ID." });
    }
    if (!result) {
      return res.status(404).json({ error: "Cohort not found." });
    }
    return res.json(result);
  } catch (err) {
    if (cohortService.isCohortValidationError(err)) {
      return res.status(400).json({ error: cohortService.formatCohortValidationError(err) });
    }
    (req.log || logger).error({ err }, "[TPO] cohort update error");
    return res.status(500).json({ error: "Failed to update cohort." });
  }
});

router.post("/cohorts/:cohortId/archive", requireRole("tpo", "admin"), requireVerified, resolveTpoInstitution, async (req, res) => {
  if (b2bGate(req, res)) return;

  try {
    const result = await cohortService.archiveCohort(req.params.cohortId, req.tpoCollege._id, req.userDoc._id);
    if (result?.invalidId) {
      return res.status(400).json({ error: "Invalid cohort ID." });
    }
    if (!result) {
      return res.status(404).json({ error: "Cohort not found." });
    }
    // Idempotent by design (TPO-2 Step 4's explicit requirement): both
    // a first-time archive and a repeat archive attempt return 200 with
    // the cohort's current (already-archived) state — a repeat call
    // never re-stamps archivedAt/archivedBy with new values, and never
    // errors. `alreadyArchived` lets a caller distinguish the two if it
    // cares to, without that distinction being part of the status code.
    return res.json({ ...result.cohort, alreadyArchived: result.alreadyArchived });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] cohort archive error");
    return res.status(500).json({ error: "Failed to archive cohort." });
  }
});

// ── COHORT ROSTER / MEMBERSHIP (TPO-2 Step 5) ───────────────────────────────
// GET    /api/tpo/cohorts/:cohortId/students                — roster (paginated/searched/sorted)
// POST   /api/tpo/cohorts/:cohortId/students                — manually add/reactivate a student by email
// DELETE /api/tpo/cohorts/:cohortId/students/:membershipId  — soft-remove a membership
//
// Same authorization shape as the cohort CRUD routes above: requireRole
// → requireVerified → resolveTpoInstitution, no primary-only gate (Step
// 4's product decision extends unchanged to roster management). Business
// logic in services/cohortMembershipService.js — see that file's header
// for the institution-matching and existing-membership-handling rules.
// No caching (see that file's header for why).

router.get("/cohorts/:cohortId/students", requireRole("tpo", "admin"), requireVerified, resolveTpoInstitution, async (req, res) => {
  if (b2bGate(req, res)) return;

  try {
    const rawPage = parseInt(req.query.page, 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const rawLimit = parseInt(req.query.limit, 10);
    const limit = Math.min(
      STUDENTS_MAX_PAGE_SIZE,
      Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : STUDENTS_DEFAULT_PAGE_SIZE
    );

    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const sort = typeof req.query.sort === "string" ? req.query.sort : undefined;

    const result = await cohortMembershipService.getCohortRoster(req.params.cohortId, req.tpoCollege._id, {
      status, search, sort, page, limit,
    });

    if (result?.invalidId) {
      return res.status(400).json({ error: "Invalid cohort ID." });
    }
    if (!result) {
      return res.status(404).json({ error: "Cohort not found." });
    }
    return res.json(result);
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] cohort roster error");
    return res.status(500).json({ error: "Failed to load cohort roster." });
  }
});

router.post("/cohorts/:cohortId/students", requireRole("tpo", "admin"), requireVerified, resolveTpoInstitution, async (req, res) => {
  if (b2bGate(req, res)) return;

  try {
    // Only email is ever read from the body — collegeId/studentId/
    // cohortId are never even looked at, let alone trusted, whether or
    // not the client sends them (same "don't just ignore it, never
    // read it" discipline as POST /cohorts above).
    const result = await cohortMembershipService.addStudentToCohort(
      req.params.cohortId, req.tpoCollege._id, req.userDoc._id, req.body?.email
    );

    if (result?.invalidId) {
      return res.status(400).json({ error: "Invalid cohort ID." });
    }
    if (!result) {
      return res.status(404).json({ error: "Cohort not found." });
    }
    if (result.archived) {
      return res.status(409).json({ error: "This cohort is archived. Add students to an active cohort instead." });
    }
    if (result.validationError) {
      return res.status(400).json({ error: result.validationError });
    }
    if (result.conflict) {
      return res.status(409).json({ error: "This person is already an active member of this cohort.", membership: result.membership });
    }
    return res.status(result.created ? 201 : 200).json({ ...result.membership, created: result.created, noop: result.noop });
  } catch (err) {
    if (cohortMembershipService.isCohortValidationError(err)) {
      return res.status(400).json({ error: cohortMembershipService.formatCohortValidationError(err) });
    }
    (req.log || logger).error({ err }, "[TPO] cohort add student error");
    return res.status(500).json({ error: "Failed to add student to cohort." });
  }
});

router.delete("/cohorts/:cohortId/students/:membershipId", requireRole("tpo", "admin"), requireVerified, resolveTpoInstitution, async (req, res) => {
  if (b2bGate(req, res)) return;

  try {
    const result = await cohortMembershipService.removeCohortMembership(
      req.params.cohortId, req.params.membershipId, req.tpoCollege._id
    );

    if (result?.invalidId) {
      return res.status(400).json({ error: "Invalid cohort or membership ID." });
    }
    if (!result) {
      return res.status(404).json({ error: "Membership not found." });
    }
    if (result.archived) {
      return res.status(409).json({ error: "This cohort is archived. Its roster can no longer be changed." });
    }
    // Idempotent, same pattern as cohort archive: a repeat removal is a
    // 200 no-op, never an error, and never re-stamps removedAt.
    return res.json({ ...result.membership, alreadyRemoved: result.alreadyRemoved });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] cohort remove student error");
    return res.status(500).json({ error: "Failed to remove student from cohort." });
  }
});

// ── POST /api/tpo/cohorts/:cohortId/import ──────────────────────────────────
// CSV roster import (TPO-2 Step 6). Same authorization shape as every
// other cohort/roster route above — requireRole → requireVerified →
// resolveTpoInstitution, no primary-only gate (verified primary AND
// secondary TPOs may both import). collegeId is never read from the
// client here either, same discipline as POST /cohorts and POST
// /cohorts/:cohortId/students above — only the URL's :cohortId and the
// uploaded file matter. All parsing/validation/matching/write logic
// lives in services/cohortImportService.js, which itself never writes a
// membership row directly — every row goes through
// cohortMembershipService.js's upsertCohortMembership(), the same
// decision tree the single-add endpoint above uses.
//
// handleCsvUpload wraps csvUpload.single("file") (middleware/csvUpload.js)
// so a multer-level rejection (wrong extension, oversized file, more
// than one file) becomes a normal 400 JSON error response instead of
// falling through to the app's generic 500 handler — multer reports
// these via a callback-style error, not a thrown exception an
// async-route-level try/catch would ever see.
function handleCsvUpload(req, res, next) {
  csvUpload.single("file")(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        const maxMb = Math.floor(cohortImportService.IMPORT_MAX_FILE_SIZE_BYTES / (1024 * 1024));
        return res.status(400).json({ error: `The CSV file exceeds the ${maxMb}MB size limit.` });
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({ error: err.message || "Only .csv files are accepted." });
      }
      return res.status(400).json({ error: "Invalid file upload." });
    }

    (req.log || logger).error({ err }, "[TPO] CSV upload error");
    return res.status(500).json({ error: "Failed to process file upload." });
  });
}

router.post("/cohorts/:cohortId/import", requireRole("tpo", "admin"), requireVerified, resolveTpoInstitution, handleCsvUpload, async (req, res) => {
  if (b2bGate(req, res)) return;

  if (!req.file) {
    return res.status(400).json({ error: 'A CSV file is required (multipart field name "file").' });
  }

  try {
    const result = await cohortImportService.importCohortRoster(
      req.params.cohortId, req.tpoCollege._id, req.userDoc._id, req.file.buffer
    );

    if (result?.invalidId) {
      return res.status(400).json({ error: "Invalid cohort ID." });
    }
    if (!result) {
      return res.status(404).json({ error: "Cohort not found." });
    }
    if (result.archived) {
      return res.status(409).json({ error: "This cohort is archived. Import into an active cohort instead." });
    }
    if (result.fileError) {
      return res.status(400).json({ error: result.fileError, reasonCode: result.reasonCode });
    }
    return res.status(200).json(result);
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] cohort CSV import error");
    return res.status(500).json({ error: "Failed to import cohort roster." });
  }
});

// ── GET /api/tpo/students ───────────────────────────────────────────────────
// Server-side paginated/searched/sorted student directory. Previously this
// returned the ENTIRE college roster in one response and TpoDashboardPage.jsx
// filtered/sorted the full array in the browser — fine at a handful of
// students, not at the thousands a real college has. Rewritten to mirror
// the same pattern recruiter.js's /candidates endpoint already established
// for this exact "search+sort+paginate a User collection" shape: a single
// Mongo aggregation with $facet (one round-trip for both the page of data
// and the total count), rather than pulling the whole collection into Node.
const STUDENT_SORT_FIELDS = {
  // Client sort key → { Mongo sort spec }. Explicit allowlist — req.query.sort
  // is never passed into .sort()/$sort directly, so a client can't inject an
  // arbitrary field or operator here. _id is always the tiebreaker so paging
  // stays stable even when many students share the same primary sort value
  // (e.g. many students with 0 XP) — without it, students could
  // duplicate/skip across page boundaries as ties get ordered inconsistently
  // between requests.
  xp: { totalXP: -1, _id: 1 },
  solved: { solvedCount: -1, _id: 1 },
  streak: { currentStreak: -1, _id: 1 },
  name: { displayName: 1, _id: 1 },
};
const STUDENTS_DEFAULT_PAGE_SIZE = 25;
const STUDENTS_MAX_PAGE_SIZE = 50; // same cap as recruiter.js's /candidates

const COHORTS_DEFAULT_PAGE_SIZE = 25;
const COHORTS_MAX_PAGE_SIZE = 50; // same cap as /students above

router.get("/students", requireRole("tpo", "admin"),
  requireVerified, async (req, res) => {
    if (b2bGate(req, res)) return;

    try {

      const domain = req.userDoc.tpoProfile?.collegeDomain;
      if (!domain) return res.status(400).json({ error: "No college domain set on this TPO account." });

      // Multi-domain college fix (TPO-1 closure): match every domain the
      // college owns, not just this TPO's own literal collegeDomain — a
      // teammate who joined via a different domain of the SAME
      // multi-domain institution was previously invisible here. The cache
      // key below intentionally stays keyed on this TPO's own literal
      // `domain` (not the full set) — see invalidateTpoCache in
      // controllers/tpoController.js, which now loops every domain of the
      // college to invalidate every such per-domain cache entry, so this
      // doesn't go stale.
      const collegeDomains = await resolveCollegeDomains(req.userDoc);

      // Normalize page/limit — never trust these as-is. Invalid, missing,
      // zero, or negative values all fall back to sane defaults rather
      // than erroring or producing an inconsistent edge case, since a
      // malformed query param here shouldn't break the page for a TPO.
      const rawPage = parseInt(req.query.page, 10);
      const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
      const rawLimit = parseInt(req.query.limit, 10);
      const limit = Math.min(
        STUDENTS_MAX_PAGE_SIZE,
        Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : STUDENTS_DEFAULT_PAGE_SIZE
      );
      const skip = (page - 1) * limit;

      // Sort: explicit allowlist only — see STUDENT_SORT_FIELDS above.
      const sortKey = STUDENT_SORT_FIELDS[req.query.sort] ? req.query.sort : "xp";
      const sortSpec = STUDENT_SORT_FIELDS[sortKey];

      // Search: college-scoped like everything else here — the $match
      // below already restricts to this TPO's own emailDomain before any
      // search term is applied, so `q` can never widen the result set
      // outside the TPO's own institution. Same regex-escaping approach as
      // recruiter.js's `college` filter, so a search term containing regex
      // metacharacters (e.g. "a.b" or "(test)") is treated literally
      // instead of as a pattern.
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const searchMatch = q
        ? {
          $or: [
            { displayName: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
            { email: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
          ],
        }
        : {};

      const cacheKey = `${TPO_CACHE_PREFIX}students:${domain}:${JSON.stringify({ page, limit, sortKey, q })}`;

      const { value: payload, cacheStatus } = await getOrSetCache(
        cacheKey,
        TPO_CACHE_TTL_SECONDS,
        async () => {
          const [aggResult] = await User.aggregate([
            { $match: { emailDomain: { $in: collegeDomains }, role: "student", visibleToTpo: { $ne: false }, ...searchMatch } },
            // solvedCount computed here, once, in Mongo — the raw
            // `solvedSlugs` array itself is never selected/projected out
            // below, so it never crosses into Node for this endpoint.
            { $addFields: { solvedCount: { $size: { $ifNull: ["$solvedSlugs", []] } } } },
            { $sort: sortSpec },
            {
              $facet: {
                data: [
                  { $skip: skip },
                  { $limit: limit },
                  {
                    $project: {
                      _id: 0,
                      name: "$displayName",
                      email: 1,
                      totalXP: { $ifNull: ["$totalXP", 0] },
                      solvedCount: 1,
                      currentStreak: { $ifNull: ["$currentStreak", 0] },
                      easy: { $ifNull: ["$solvedDifficulty.easy", 0] },
                      medium: { $ifNull: ["$solvedDifficulty.medium", 0] },
                      hard: { $ifNull: ["$solvedDifficulty.hard", 0] },
                      joinedDate: 1,
                    },
                  },
                ],
                totalCount: [{ $count: "count" }],
              },
            },
          ]);

          return {
            students: aggResult?.data ?? [],
            total: aggResult?.totalCount?.[0]?.count ?? 0,
          };
        }
      );

      res.set("X-Cache", cacheStatus);
      return res.json({
        college: req.userDoc.tpoProfile?.collegeName,
        domain,
        students: payload.students,
        total: payload.total,
        page,
        limit,
      });

    } catch (err) {
      (req.log || logger).error({ err }, "[TPO] students error");
      return res.status(500).json({ error: "Failed to load students." });
    }
  });


// ── GET /api/tpo/dashboard ──────────────────────────────────────────────────
// Returns aggregated class-wide stats for the TPO dashboard view.
//
// Cohort slicing:
//   GET /dashboard                 -> college-wide numbers + `cohortBreakdown`
//                                     (same numbers, one row per cohort)
//   GET /dashboard?cohortId=<id>   -> the same shape scoped to ONE cohort
//                                     (404 if the cohort isn't this college's,
//                                     400 if the id is malformed)
router.get("/dashboard", requireRole("tpo", "admin"),
  requireVerified, async (req, res) => {
    if (b2bGate(req, res)) return;

    try {


      const domain = req.userDoc.tpoProfile?.collegeDomain;
      if (!domain) return res.status(400).json({ error: "No college domain set." });

      // Multi-domain college fix (TPO-1 closure) — see the matching
      // comment in GET /students above.
      const collegeDomains = await resolveCollegeDomains(req.userDoc);

      // Optional cohort slice. Ownership is verified through the same
      // non-leaking lookup the /cohorts routes use, so a TPO can never
      // read another institution's cohort by guessing an id.
      let cohortSlice = null;
      const rawCohortId = typeof req.query.cohortId === "string" ? req.query.cohortId.trim() : "";
      if (rawCohortId) {
        const college = await getCollegeForTpo(req.userDoc);
        if (!college) return res.status(400).json({ error: "No college found for this TPO account." });
        const cohort = await cohortService.getCohortForCollege(rawCohortId, college._id);
        if (cohort?.invalidId) return res.status(400).json({ error: "Invalid cohort ID." });
        if (!cohort) return res.status(404).json({ error: "Cohort not found." });
        cohortSlice = {
          cohort,
          studentIds: await getActiveCohortStudentIds(rawCohortId),
        };
      }
      const collegeForBreakdown = cohortSlice ? null : await getCollegeForTpo(req.userDoc);

      // Key suffix keeps the `tpo:dashboard:<domain>` prefix, so
      // invalidateTpoCache's prefix invalidation clears cohort slices too.
      const { value: dashboard, cacheStatus } = await getOrSetCache(
        `${TPO_CACHE_PREFIX}dashboard:${domain}${cohortSlice ? `:cohort:${rawCohortId}` : ""}`,
        TPO_CACHE_TTL_SECONDS,
        async () => {
          // Two facets in one round-trip against the same $match filter:
          // "summary" sums the per-student numeric fields directly (no
          // need to pull solvedSlugs/solvedDifficulty into Node just to
          // add them up), and "topicCoverage" unwinds each student's
          // topicStats array and sums counts per topic in Mongo. Both used
          // to be a single forEach over every student document pulled
          // into Node — fine at "hundreds of students," but transferring
          // every student's full solvedSlugs/topicStats array over the
          // wire just to add up numbers doesn't hold as a college's
          // student count grows.
          const [aggResult] = await User.aggregate([
            {
              $match: {
                emailDomain: { $in: collegeDomains },
                role: "student",
                ...(cohortSlice ? { _id: { $in: cohortSlice.studentIds } } : {}),
              },
            },
            {
              $facet: {
                visibleSummary: [
                  { $match: { visibleToTpo: { $ne: false } } },
                  {
                    $group: {
                      _id: null,
                      totalStudents: { $sum: 1 },
                      totalSolved: { $sum: { $size: { $ifNull: ["$solvedSlugs", []] } } },
                      totalEasy: { $sum: { $ifNull: ["$solvedDifficulty.easy", 0] } },
                      totalMedium: { $sum: { $ifNull: ["$solvedDifficulty.medium", 0] } },
                      totalHard: { $sum: { $ifNull: ["$solvedDifficulty.hard", 0] } },
                      activeThisWeek: {
                        $sum: { $cond: [{ $gt: [{ $ifNull: ["$currentStreak", 0] }, 0] }, 1, 0] },
                      },
                    },
                  },
                ],
                optOutCount: [
                  { $match: { visibleToTpo: false } },
                  { $count: "count" },
                ],
                topicCoverage: [
                  { $match: { visibleToTpo: { $ne: false } } },
                  // topicStats is a Mongoose Map (stored as a sub-document,
                  // not an array), so it needs $objectToArray before $unwind.
                  { $project: { t: { $objectToArray: { $ifNull: ["$topicStats", {}] } } } },
                  { $unwind: "$t" },
                  {
                    $group: {
                      _id: "$t.k",
                      totalSolves: { $sum: "$t.v" },
                    },
                  },
                  { $sort: { totalSolves: -1 } },
                  { $limit: 10 },
                  { $project: { _id: 0, topic: "$_id", totalSolves: 1 } },
                ],
              },
            },
          ]);

          const summary = aggResult?.visibleSummary?.[0];
          const optedOutStudents = aggResult?.optOutCount?.[0]?.count ?? 0;

          if (!summary || summary.totalStudents === 0) {
            return {
              totalStudents: 0,
              optedOutStudents,
              message: optedOutStudents > 0
                ? "All visible students from your college are currently opted out of TPO visibility."
                : "No students from your college have joined Code Club yet.",
            };
          }

          const { totalStudents, totalSolved, totalEasy, totalMedium, totalHard, activeThisWeek } = summary;
          const avgSolved = Math.round((totalSolved / totalStudents) * 10) / 10;

          // Placement Readiness Score (0-100) — shared heuristic, see
          // utils/readiness.js (also used for per-cohort scores).
          const readinessScore = computeReadinessScore({
            totalStudents, totalSolved, totalHard, activeStudents: activeThisWeek,
          });

          return {
            totalStudents,
            avgSolved,
            totalSolved,
            difficultyBreakdown: { easy: totalEasy, medium: totalMedium, hard: totalHard },
            activeThisWeek,
            activePercent: Math.round((activeThisWeek / totalStudents) * 100),
            readinessScore,
            topicCoverage: aggResult?.topicCoverage ?? [],
            optedOutStudents,
            ...(collegeForBreakdown
              ? {
                  cohortBreakdown: await getCohortBreakdown({
                    collegeId: collegeForBreakdown._id,
                    collegeDomains,
                  }),
                }
              : {}),
          };
        }
      );

      res.set("X-Cache", cacheStatus);
      // college/domain come from the live req.userDoc, not the cached payload,
      // since they're cheap to read and shouldn't go stale even if the
      // aggregate numbers do for a couple minutes.
      return res.json({
        college: req.userDoc.tpoProfile?.collegeName,
        domain,
        ...(cohortSlice
          ? { cohort: { cohortId: cohortSlice.cohort.id, name: cohortSlice.cohort.name } }
          : {}),
        ...dashboard,
      });

    } catch (err) {
      (req.log || logger).error({ err }, "[TPO] dashboard error");
      return res.status(500).json({ error: "Failed to load dashboard." });
    }
  });


// ── POST /api/tpo/assignments ───────────────────────────────────────────────
// TPO creates a new problem assignment for their college.
//
// requireVerified added here (2026-09) — this route was missing it while
// every other TPO route already had it (see /me, /students, /dashboard,
// /report/pdf below). Without it, a pending/unverified TPO account could
// create an assignment and trigger a mass notification to every real
// student on their claimed college domain before any admin had ever
// reviewed the account. See docs/audits/ TPO security audit.
router.post("/assignments", requireRole("tpo", "admin"), requireVerified, async (req, res) => {
  if (b2bGate(req, res)) return;

  try {


    const { title, problemSlugs, dueDate, cohortId } = req.body;

    if (!title || !Array.isArray(problemSlugs) || problemSlugs.length === 0 || !dueDate) {
      return res.status(400).json({ error: "title, problemSlugs (array), and dueDate are required." });
    }

    // TPO-4: an assignment may target one institution-managed cohort.
    // The cohort is always resolved through its College boundary; a TPO
    // can never target another institution by supplying an arbitrary id.
    let targetCohort = null;
    let callerCollege = null;
    if (cohortId !== undefined && cohortId !== null && cohortId !== "") {
      if (!mongoose.isValidObjectId(cohortId)) {
        return res.status(400).json({ error: "Invalid cohort ID." });
      }

      targetCohort = await Cohort.findById(cohortId).lean();
      if (!targetCohort) {
        return res.status(404).json({ error: "Cohort not found." });
      }
      if (targetCohort.status === "archived") {
        return res.status(409).json({ error: "This cohort is archived and cannot receive new assignments." });
      }

      callerCollege = await getCollegeForTpo(req.userDoc);
      if (req.userDoc.role !== "admin") {
        if (!callerCollege || String(callerCollege._id) !== String(targetCohort.collegeId)) {
          return res.status(403).json({ error: "This cohort does not belong to your college." });
        }
      }
    }

    if (req.userDoc.role !== "admin" && !callerCollege) {
      callerCollege = await getCollegeForTpo(req.userDoc);
    }

    let assignmentCollegeDomain = req.userDoc.tpoProfile?.collegeDomain?.toLowerCase();
    let assignmentCollegeId = callerCollege?._id ?? null;

    if (!assignmentCollegeDomain && targetCohort) {
      const targetCollege = await College.findById(targetCohort.collegeId)
        .select("_id domains")
        .lean();
      assignmentCollegeDomain = targetCollege?.domains?.[0];
      assignmentCollegeId = targetCollege?._id ?? assignmentCollegeId;
    }
    // Preserve the existing admin middleware bypass for legacy assignments.
    // An admin without a cohort has no institution context on the request;
    // legacy behavior leaves the domain unset rather than turning the
    // requireVerified bypass into a new authorization failure. Cohort-targeted
    // admin assignments are safe because their domain is resolved from the
    // cohort's owning College above.
    const assignmentPayload = {
      tpoId: req.userDoc._id,
      collegeDomain: assignmentCollegeDomain,
      cohortId: targetCohort?._id ?? null,
      title,
      problemSlugs,
      dueDate: new Date(dueDate),
    };

    if (assignmentCollegeId) {
      assignmentPayload.collegeId = assignmentCollegeId;
    }

    const assignment = await Assignment.create(assignmentPayload);

    // Fan out only to the assignment audience. Legacy assignments with no
    // cohortId remain college-wide for backward compatibility.
    const domain = req.userDoc.tpoProfile?.collegeDomain?.toLowerCase();
    const assignmentCollegeDomains = callerCollege?.domains?.length
      ? callerCollege.domains.map((d) => d.toLowerCase())
      : domain
        ? [domain]
        : [];

    if (targetCohort || assignmentCollegeDomains.length) {
      const studentQuery = targetCohort
        ? {
            role: "student",
            _id: {
              $in: await CohortMembership.find({
                cohortId: targetCohort._id,
                status: "active",
                studentId: { $ne: null },
              }).distinct("studentId"),
            },
          }
        : {
            emailDomain: { $in: assignmentCollegeDomains },
            role: "student",
          };

      User.find(studentQuery)
        .select("_id")
        .lean()
        .then((students) =>
          createNotificationBulk(
            students.map((s) => s._id),
            {
              type: "assignment_created",
              title: "New assignment posted",
              message: `${title} — due ${new Date(dueDate).toLocaleDateString()}`,
              link: "/problems",
              meta: { assignmentId: assignment._id },
            }
          )
        )
        .catch((err) => (req.log || logger).error({ err }, "[TPO] Assignment notification fan-out failed"));
    }

    return res.status(201).json(assignment);
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] create assignment error");
    return res.status(500).json({ error: "Failed to create assignment." });
  }
});

// ── GET /api/tpo/assignments ────────────────────────────────────────────────
// TPO view: all assignments they've created, with per-student completion %.
// requireVerified added here (2026-09) — see the POST /assignments comment
// above for why.
router.get("/assignments", requireRole("tpo", "admin"), requireVerified, async (req, res) => {
  if (b2bGate(req, res)) return;

  try {
    const domain = req.userDoc.tpoProfile?.collegeDomain?.toLowerCase();
    if (!domain && req.userDoc.role !== "admin") {
      return res.status(400).json({ error: "No college domain set on this TPO account." });
    }

    // TPO-4: legacy assignments remain college-wide. Cohort assignments
    // are measured only against active members of their target cohort.
    // Multi-domain colleges must share the same assignment feed across all
    // domains owned by the institution, not only the domain the current
    // TPO registered with.
    // Resolve all target cohorts/members in bounded bulk queries so the
    // dashboard does not perform one membership/user query per assignment.
    const collegeDomains = req.userDoc.role === "admin"
      ? []
      : await resolveCollegeDomains(req.userDoc);
    const college = req.userDoc.role === "admin"
      ? null
      : await getCollegeForTpo(req.userDoc);

    const assignmentQuery = college
      ? {
          $or: [
            { collegeId: college._id },
            {
              collegeId: null,
              collegeDomain: { $in: collegeDomains },
            },
          ],
        }
      : {};
    const assignments = await Assignment.find(assignmentQuery)
      .sort({ dueDate: -1 })
      .lean();

    const cohortIds = assignments
      .filter((a) => a.cohortId)
      .map((a) => a.cohortId);

    const [cohorts, cohortMemberships] = cohortIds.length
      ? await Promise.all([
          Cohort.find({ _id: { $in: cohortIds } })
            .select("name academicYear graduatingYear branch section status collegeId")
            .lean(),
          CohortMembership.find({
            cohortId: { $in: cohortIds },
            status: "active",
            studentId: { $ne: null },
          })
            .select("cohortId studentId")
            .lean(),
        ])
      : [[], []];

    const cohortById = new Map(cohorts.map((cohort) => [String(cohort._id), cohort]));
    const studentIdsByCohort = new Map();
    for (const membership of cohortMemberships) {
      const key = String(membership.cohortId);
      if (!studentIdsByCohort.has(key)) studentIdsByCohort.set(key, new Set());
      studentIdsByCohort.get(key).add(String(membership.studentId));
    }

    const legacyStudents = collegeDomains.length
      ? await User.find({ emailDomain: { $in: collegeDomains }, role: "student" })
          .select("_id solvedSlugs")
          .lean()
      : [];

    const cohortStudentIds = [...studentIdsByCohort.values()]
      .flatMap((ids) => [...ids]);
    const allStudentIds = [...new Set([
      ...legacyStudents.map((s) => String(s._id)),
      ...cohortStudentIds,
    ])];

    const cohortStudents = allStudentIds.length
      ? await User.find({
          _id: { $in: allStudentIds },
          role: "student",
        })
          .select("_id solvedSlugs")
          .lean()
      : [];
    const solvedByStudentId = new Map(
      cohortStudents.map((student) => [String(student._id), student.solvedSlugs || []])
    );

    const legacyStudentIds = new Set(legacyStudents.map((s) => String(s._id)));

    const enriched = assignments.map((assignment) => {
      let audienceIds;
      let cohort = null;

      if (assignment.cohortId) {
        const cohortKey = String(assignment.cohortId);
        audienceIds = studentIdsByCohort.get(cohortKey) || new Set();
        cohort = cohortById.get(cohortKey) || null;
      } else {
        audienceIds = legacyStudentIds;
      }

      const totalStudents = audienceIds.size;
      let completedCount = 0;
      for (const studentId of audienceIds) {
        const solved = solvedByStudentId.get(studentId) || [];
        if (assignment.problemSlugs.every((slug) => solved.includes(slug))) {
          completedCount += 1;
        }
      }

      return {
        ...assignment,
        cohort: cohort
          ? {
              _id: cohort._id,
              name: cohort.name,
              academicYear: cohort.academicYear,
              graduatingYear: cohort.graduatingYear,
              branch: cohort.branch,
              section: cohort.section,
              status: cohort.status,
            }
          : null,
        completedCount,
        totalStudents,
        completionPercent: totalStudents
          ? Math.round((completedCount / totalStudents) * 100)
          : 0,
        isOverdue: new Date(assignment.dueDate) < new Date(),
      };
    });

    return res.json({ assignments: enriched });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] list assignments error");
    return res.status(500).json({ error: "Failed to load assignments." });
  }
});

// ── POST /api/tpo/assignments/:id/archive ──────────────────────────────────
// Archives an assignment without deleting its history or completion data.
// Archived assignments are retained for TPO reporting but are no longer
// delivered to students or eligible for reminders.
router.post("/assignments/:id/archive", requireRole("tpo", "admin"), requireVerified, async (req, res) => {
  if (b2bGate(req, res)) return;

  try {
    const domain = req.userDoc.tpoProfile?.collegeDomain?.toLowerCase();
    if (!domain && req.userDoc.role !== "admin") {
      return res.status(400).json({ error: "No college domain set on this TPO account." });
    }

    const college = req.userDoc.role === "admin"
      ? null
      : await getCollegeForTpo(req.userDoc);
    const collegeDomains = college?.domains?.length
      ? college.domains.map((d) => d.toLowerCase())
      : domain
        ? [domain]
        : [];

    const assignmentQuery = { _id: req.params.id };
    if (college) {
      assignmentQuery.$or = [
        { collegeId: college._id },
        { collegeId: null, collegeDomain: { $in: collegeDomains } },
      ];
    } else if (domain) {
      assignmentQuery.collegeDomain = domain;
    }

    const assignment = await Assignment.findOneAndUpdate(
      assignmentQuery,
      { $set: { status: "archived" } },
      { new: true }
    ).lean();

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found." });
    }

    return res.json(assignment);
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] archive assignment");
    return res.status(500).json({ error: "Failed to archive assignment." });
  }
});

// ── Shared assignment-audience resolution ───────────────────────────────────
// Used by both /remind and /completion: resolves the assignment (scoped to
// the caller's college — an assignment belonging to another institution is
// never visible, same boundary as everywhere else in this file) and its
// audience of students (cohort membership for cohort-scoped assignments,
// legacy college-wide roster otherwise). Writes the 400/404 response itself
// and returns null so callers can `if (!resolved) return;`.
//
// Deliberately does NOT filter by visibleToTpo: assignment delivery is
// membership-driven, not gated by the TPO-3 dashboard/directory opt-out —
// see the identical note on GET /api/assignments/student above. A student
// who opted out of TPO analytics still receives and is nudged about
// assignments they're a target of.
async function resolveAssignmentAudience(req, res, selectFields = "_id solvedSlugs") {
  const domain = req.userDoc.tpoProfile?.collegeDomain?.toLowerCase();
  if (!domain && req.userDoc.role !== "admin") {
    res.status(400).json({ error: "No college domain set on this TPO account." });
    return null;
  }

  const college = req.userDoc.role === "admin"
    ? null
    : await getCollegeForTpo(req.userDoc);
  const collegeDomains = college?.domains?.length
    ? college.domains.map((d) => d.toLowerCase())
    : domain
      ? [domain]
      : [];

  const assignmentQuery = { _id: req.params.id };
  if (college) {
    assignmentQuery.$or = [
      { collegeId: college._id },
      {
        collegeId: null,
        collegeDomain: { $in: collegeDomains },
      },
    ];
  } else if (domain) {
    assignmentQuery.collegeDomain = domain;
  }

  const assignment = await Assignment.findOne(assignmentQuery).lean();
  if (!assignment) {
    res.status(404).json({ error: "Assignment not found." });
    return null;
  }

  let students;
  if (assignment.cohortId) {
    const studentIds = await CohortMembership.find({
      cohortId: assignment.cohortId,
      status: "active",
      studentId: { $ne: null },
    }).distinct("studentId");
    students = await User.find({
      _id: { $in: studentIds },
      role: "student",
    }).select(selectFields).lean();
  } else {
    const audienceDomains = assignment.collegeId && college?.domains?.length
      ? college.domains.map((d) => d.toLowerCase())
      : domain
        ? [domain]
        : [];

    students = await User.find({
      emailDomain: { $in: audienceDomains },
      role: "student",
    }).select(selectFields).lean();
  }

  return { assignment, students };
}

// ── POST /api/tpo/assignments/:id/remind ────────────────────────────────────
// Nudges every student on this college's roster who hasn't completed the
// assignment yet. Reuses the same createNotificationBulk fan-out the
// assignment-creation flow already uses for consistency. Extracted as a
// named function (rather than inline, like handleCreateInterest in
// recruiter.js) so it can be unit-tested directly.
export async function handleRemindAssignment(req, res) {
  if (b2bGate(req, res)) return;

  try {
    const resolved = await resolveAssignmentAudience(req, res, "_id solvedSlugs");
    if (!resolved) return;
    const { assignment, students } = resolved;

    if (assignment.status === "archived") {
      return res.status(409).json({ error: "Archived assignments cannot be reminded." });
    }

    const incomplete = students.filter(s =>
      !assignment.problemSlugs.every(slug => (s.solvedSlugs || []).includes(slug))
    );

    if (incomplete.length === 0) {
      return res.json({ remindedCount: 0, message: "Everyone has already completed this assignment." });
    }

    await createNotificationBulk(
      incomplete.map(s => s._id),
      {
        type: "assignment_reminder",
        title: "Reminder: assignment due soon",
        message: `${assignment.title} — due ${new Date(assignment.dueDate).toLocaleDateString()}. You haven't finished it yet.`,
        link: "/problems",
        meta: { assignmentId: assignment._id },
      }
    );

    return res.json({ remindedCount: incomplete.length });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] assignment remind");
    return res.status(500).json({ error: "Failed to send reminder." });
  }
}

// requireVerified added here (2026-09) — see the POST /assignments comment
// above for why.
router.post("/assignments/:id/remind", requireRole("tpo", "admin"), requireVerified, handleRemindAssignment);

// ── GET /api/tpo/assignments/:id/completion ─────────────────────────────────
// Per-assignment completion detail: the natural next step off /remind above
// — same audience, same ownership check — but returns the full breakdown
// instead of firing notifications: X/Y students who've solved every problem
// in the assignment, plus a `stragglers` list (who's short, how many
// problems, and exactly which slugs they're missing) so a TPO can see who
// to follow up with without sending a blanket reminder. Unlike /remind, this
// is read-only and works on archived assignments too, since a TPO reviewing
// history still wants to know who finished.
export async function handleAssignmentCompletion(req, res) {
  if (b2bGate(req, res)) return;

  try {
    const resolved = await resolveAssignmentAudience(req, res, "_id displayName email solvedSlugs");
    if (!resolved) return;
    const { assignment, students } = resolved;

    let completedCount = 0;
    const stragglers = [];
    for (const student of students) {
      const solved = new Set(student.solvedSlugs || []);
      const missingSlugs = assignment.problemSlugs.filter((slug) => !solved.has(slug));
      if (missingSlugs.length === 0) {
        completedCount += 1;
        continue;
      }
      stragglers.push({
        // HTTP/JSON contract: never leak a BSON ObjectId instance from this response.
        // Keep the public completion payload consistent with the existing tests and
        // other TPO endpoints, which expose student identifiers as strings.
        studentId: student._id.toString(),
        name: student.displayName,
        email: student.email,
        solvedCount: assignment.problemSlugs.length - missingSlugs.length,
        totalProblems: assignment.problemSlugs.length,
        missingSlugs,
      });
    }

    // Furthest behind first, so the TPO sees who needs the most help at
    // the top of the list; ties broken by name for a stable order.
    stragglers.sort((a, b) => a.solvedCount - b.solvedCount || (a.name || "").localeCompare(b.name || ""));

    const totalStudents = students.length;
    return res.json({
      assignmentId: assignment._id,
      title: assignment.title,
      dueDate: assignment.dueDate,
      status: assignment.status,
      totalStudents,
      completedCount,
      completionPercent: totalStudents ? Math.round((completedCount / totalStudents) * 100) : 0,
      stragglers,
    });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] assignment completion");
    return res.status(500).json({ error: "Failed to load assignment completion." });
  }
}

router.get("/assignments/:id/completion", requireRole("tpo", "admin"), requireVerified, handleAssignmentCompletion);

// ── GET /api/assignments/student ────────────────────────────────────────────
// Student view: assignments relevant to their college, with their own progress.
// Mounted separately (not /api/tpo/* — students aren't TPOs).
export const studentAssignmentsRouter = Router();

studentAssignmentsRouter.get("/", async (req, res) => {
  if (!B2B_ENABLED) return res.json({ enabled: false, assignments: [] });

  try {
    if (!req.userDoc?.email) return res.json({ assignments: [] });

    const domain = req.userDoc.email.split("@")[1]?.toLowerCase();
    if (!domain) return res.json({ enabled: true, assignments: [] });

    // A student receives canonical college-wide assignments via collegeId,
    // with a collegeDomain fallback for legacy assignments that predate the
    // migration. Cohort assignments remain membership-driven. This
    // intentionally uses membership rather than visibleToTpo: TPO-3 privacy
    // controls directory/dashboard visibility, while assignment targeting is
    // an explicit cohort operation.
    const studentCollege = await College.findByDomain(domain);
    const activeMemberships = await CohortMembership.find({
      studentId: req.userDoc._id,
      status: "active",
    })
      .select("cohortId")
      .lean();
    const activeCohortIds = activeMemberships.map((membership) => membership.cohortId);

    const collegeWideAssignmentClauses = studentCollege
      ? [
          { collegeId: studentCollege._id, cohortId: null },
          { collegeId: null, collegeDomain: domain, cohortId: null },
        ]
      : [{ collegeId: null, collegeDomain: domain, cohortId: null }];

    const assignments = await Assignment.find({
      status: { $ne: "archived" },
      $or: [
        ...collegeWideAssignmentClauses,
        ...(activeCohortIds.length ? [{ cohortId: { $in: activeCohortIds } }] : []),
      ],
    })
      .sort({ dueDate: 1 })
      .lean();

    const cohortIds = assignments.filter((a) => a.cohortId).map((a) => a.cohortId);
    const cohorts = cohortIds.length
      ? await Cohort.find({ _id: { $in: cohortIds } })
          .select("name academicYear graduatingYear branch section status")
          .lean()
      : [];
    const cohortById = new Map(cohorts.map((cohort) => [String(cohort._id), cohort]));

    const solvedSet = new Set(req.userDoc.solvedSlugs || []);

    const enriched = assignments.map((assignment) => {
      const solvedCount = assignment.problemSlugs.filter((slug) => solvedSet.has(slug)).length;
      const cohort = assignment.cohortId ? cohortById.get(String(assignment.cohortId)) : null;
      return {
        _id: assignment._id,
        title: assignment.title,
        dueDate: assignment.dueDate,
        problemSlugs: assignment.problemSlugs,
        cohort: cohort
          ? {
              _id: cohort._id,
              name: cohort.name,
              academicYear: cohort.academicYear,
              graduatingYear: cohort.graduatingYear,
              branch: cohort.branch,
              section: cohort.section,
              status: cohort.status,
            }
          : null,
        solvedCount,
        totalProblems: assignment.problemSlugs.length,
        isComplete: solvedCount === assignment.problemSlugs.length,
        isOverdue: new Date(assignment.dueDate) < new Date(),
      };
    });

    return res.json({ enabled: true, assignments: enriched });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load assignments." });
  }
});


// ── GET /api/tpo/report/pdf ─────────────────────────────────────────────────
// Generates a class performance PDF — the document a TPO shows their
// placement director to justify the Code Club subscription.
// ── GET /api/tpo/report/overview ───────────────────────────────────────────
// Canonical institution-scoped reporting metrics.
router.get("/report/overview", requireRole("tpo", "admin"),
  requireVerified, async (req, res) => {
    if (b2bGate(req, res)) return;

    try {
      const domain = req.userDoc.tpoProfile?.collegeDomain;
      if (!domain && req.userDoc.role !== "admin") {
        return res.status(400).json({ error: "No college domain set on this TPO account." });
      }

      const college = req.userDoc.role === "admin"
        ? (req.query.collegeId ? await College.findById(req.query.collegeId).lean() : null)
        : await getCollegeForTpo(req.userDoc);

      if (!college) {
        return res.status(400).json({
          error: req.userDoc.role === "admin"
            ? "collegeId is required for admin report requests."
            : "No college found for this TPO account.",
        });
      }

      const report = await getInstitutionReportOverview({
        college,
        from: req.query.from,
        to: req.query.to,
      });

      return res.json({ college: college.name, collegeId: college._id, ...report });
    } catch (err) {
      if (err?.code === "INVALID_DATE_RANGE") {
        return res.status(400).json({ error: err.message });
      }
      (req.log || logger).error({ err }, "[TPO] report overview error");
      return res.status(500).json({ error: "Failed to generate report overview." });
    }
  });


router.get("/report/pdf", requireRole("tpo", "admin"),
  requireVerified, async (req, res) => {
    if (b2bGate(req, res)) return;

    let PDFDocument;
    try {
      PDFDocument = require("pdfkit");
    } catch {
      return res.status(503).json({ error: "PDF generation unavailable. Run: cd backend && npm install pdfkit" });
    }

    try {
      let college;
      if (req.userDoc.role === "admin") {
        if (!req.query.collegeId) return res.status(400).json({ error: "collegeId is required." });
        college = await College.findById(req.query.collegeId).lean();
      } else {
        college = await getCollegeForTpo(req.userDoc);
      }

      if (!college || college.status !== "verified") {
        return res.status(404).json({ error: "Verified college not found." });
      }

      // The PDF summary uses the same canonical institution report service
      // as the dashboard. Student rankings use the same institution boundary
      // and TPO visibility policy, so opted-out students never leak into PDF.
      const report = await getInstitutionReportOverview({
        college,
        from: req.query.from,
        to: req.query.to,
      });

      const collegeDomains = college.domains.map((d) => d.toLowerCase());
      const students = await User.find({
        $and: [
          { role: "student", visibleToTpo: { $ne: false } },
          {
            $or: [
              { "education.collegeId": college._id },
              {
                $or: [
                  { "education.collegeId": null },
                  { "education.collegeId": { $exists: false } },
                ],
                emailDomain: { $in: collegeDomains },
              },
            ],
          },
        ],
      })
        .select("displayName totalXP solvedSlugs currentStreak")
        .sort({ totalXP: -1 })
        .lean();

      const collegeName = college.name || "College";
      const domainLabel = collegeDomains.join(", ");

      const doc = new PDFDocument({ size: "A4", margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${collegeName.replace(/[^a-z0-9]/gi, "_")}_codeclub_report.pdf"`);
      doc.pipe(res);

      doc.rect(0, 0, doc.page.width, 90).fill("#18181b");
      doc.fontSize(22).fillColor("#22c55e").font("Helvetica-Bold").text("Code Club", 50, 24);
      doc.fontSize(11).fillColor("#a1a1aa").font("Helvetica").text("Institution Performance Report", 50, 52);
      doc.fontSize(10).fillColor("#71717a")
        .text(new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), doc.page.width - 200, 52, { align: "right", width: 150 });

      doc.fontSize(18).fillColor("#000").font("Helvetica-Bold").text(collegeName, 50, 110);
      doc.fontSize(9).fillColor("#71717a").font("Helvetica").text(domainLabel, 50, 134);
      doc.fontSize(9).fillColor("#71717a")
        .text(`Report period: ${new Date(report.range.from).toLocaleDateString("en-IN")} — ${new Date(report.range.to).toLocaleDateString("en-IN")}`, 50, 148);

      let sy = 175;
      const summary = [
        { label: "Visible Students", value: report.students.total },
        { label: "Avg Problems Solved", value: report.problems.averageSolved },
        { label: "Active Students", value: `${report.students.active} (${report.students.activePercent}%)` },
        { label: "Total Problems Solved", value: report.problems.totalSolved },
      ];
      let sx = 50;
      summary.forEach((item) => {
        doc.rect(sx, sy, 120, 50).fill("#f4f4f5");
        doc.fontSize(18).fillColor("#16a34a").font("Helvetica-Bold").text(String(item.value), sx + 10, sy + 8);
        doc.fontSize(8).fillColor("#71717a").font("Helvetica").text(item.label, sx + 10, sy + 30, { width: 100 });
        sx += 130;
      });

      let ty = sy + 75;
      doc.fontSize(12).fillColor("#000").font("Helvetica-Bold").text("STUDENT RANKINGS", 50, ty);
      ty += 22;
      doc.fontSize(8).fillColor("#71717a").font("Helvetica-Bold");
      doc.text("Rank", 50, ty); doc.text("Name", 90, ty); doc.text("Solved", 320, ty);
      doc.text("Streak", 380, ty); doc.text("XP", 450, ty);
      ty += 14;
      doc.moveTo(50, ty).lineTo(doc.page.width - 50, ty).strokeColor("#e4e4e7").stroke();
      ty += 8;

      students.slice(0, 40).forEach((student, i) => {
        if (ty > doc.page.height - 60) { doc.addPage(); ty = 50; }
        doc.fontSize(8).fillColor("#3f3f46").font("Helvetica");
        doc.text(String(i + 1), 50, ty);
        doc.text(student.displayName || "—", 90, ty, { width: 220 });
        doc.text(String(student.solvedSlugs?.length ?? 0), 320, ty);
        doc.text(String(student.currentStreak ?? 0), 380, ty);
        doc.text(String(student.totalXP ?? 0), 450, ty);
        ty += 16;
      });

      const footerY = doc.page.height - 40;
      doc.fontSize(8).fillColor("#a1a1aa")
        .text(`Generated by Code Club · ${SITE_URL.replace("https://","")}`, 50, footerY, { align: "center", width: doc.page.width - 100 });

      doc.end();
    } catch (err) {
      (req.log || logger).error({ err }, "[TPO] report PDF error");
      if (!res.headersSent) {
        if (err?.code === "INVALID_DATE_RANGE") {
          return res.status(400).json({ error: "Invalid report date range." });
        }
        res.status(500).json({ error: "Failed to generate report." });
      }
    }
  });

export default router;