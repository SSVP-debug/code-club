import { Router } from "express";
import { logger } from "../config/logger.js";
import User from "../models/User.js";
import { B2B_ENABLED } from "../config/featureFlags.js";
import Assignment from "../models/Assignment.js";
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
import multer from "multer";
import { csvUpload } from "../middleware/csvUpload.js";

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
      // The "unnecessary box" bug class: a College record whose name is
      // literally someone's email address, pasted into the wrong field.
      // Reject it here instead of silently storing it.
      return res.status(400).json({
        error: "That looks like an email address — please enter your college's name instead.",
      });
    }

    const email = req.userDoc.email || "";
    const domain = email.split("@")[1];

    if (!domain || isConsumerEmailDomain(domain)) {
      return res.status(400).json({
        error: "Please sign up with your institutional email (e.g. yourname@college.ac.in), not a personal email.",
      });
    }

    // A second TPO from a domain that's already verified doesn't need
    // another manual review — the college itself has already been vetted.
    // A domain still pending review from an earlier TPO or student stays
    // blocked from a second claim, to avoid two conflicting requests in
    // the queue — UNLESS the existing record is an auto-detected
    // placeholder (submittedByRole: "auto", created the moment some
    // student first signed up from this domain — see
    // services/collegeAutoProvision.js). Nobody actually submitted that
    // one; it's not a real claim to conflict with, so a TPO registering
    // for the same domain should be able to claim/upgrade it rather than
    // being blocked by a guess nobody reviewed.
    const existingCollege = await College.findByDomain(domain);
    const existingIsAutoPlaceholder = existingCollege?.submittedByRole === "auto";

    if (existingCollege && existingCollege.status !== "verified" && !existingIsAutoPlaceholder) {
      return res.status(409).json({
        error: "This college is already registered and pending verification.",
        status: existingCollege.status,
      });
    }

    const now = new Date();
    // Hybrid verification (Phase B): known college domains — including one
    // already verified via an earlier TPO from the same college — skip the
    // queue. Everything else is created pending and shows up in
    // GET /api/admin/pending for manual approval.
    const autoVerified =
      (existingCollege?.status === "verified" && !existingIsAutoPlaceholder) ||
      (await isDomainAutoVerified(domain, "college"));

    // Tracks the resolved College doc across all three branches below
    // (brand new / upgraded placeholder / already-verified existing) so
    // the primary-TPO claim after it can run against a real _id in every
    // case, not just the "created a new one" branch. Also tracks enough
    // to roll a College-side change back if the User-side save fails
    // right after — see the try/catch around req.userDoc.save() below.
    let collegeDoc = existingCollege;
    let createdNewCollege = false;
    let placeholderSnapshot = null;
    if (!existingCollege) {
      collegeDoc = await College.create({
        domains: [domain],
        name: collegeName,
        status: autoVerified ? "verified" : "pending",
        verifiedAt: autoVerified ? now : null,
        submittedBy: req.userDoc._id,
        submittedByRole: "tpo",
      });
      createdNewCollege = true;
    } else if (existingIsAutoPlaceholder) {
      // Upgrade the auto-detected placeholder into a real TPO submission
      // — replace the guessed name with the TPO's actual college name and
      // record who's now vouching for it, rather than leaving a second,
      // duplicate College doc for the same domain.
      placeholderSnapshot = {
        name: existingCollege.name,
        status: existingCollege.status,
        verifiedAt: existingCollege.verifiedAt,
        submittedBy: existingCollege.submittedBy,
        submittedByRole: existingCollege.submittedByRole,
      };
      existingCollege.name = collegeName;
      existingCollege.status = autoVerified ? "verified" : "pending";
      existingCollege.verifiedAt = autoVerified ? now : null;
      existingCollege.submittedBy = req.userDoc._id;
      existingCollege.submittedByRole = "tpo";
      await existingCollege.save();
    }

    // Mark user as TPO. Previously this dropped collegeDomain/collegeName
    // entirely — tpoProfile only ever got verificationStatus (not even a
    // real schema field) + verified + requestedAt, so every TPO's own
    // college identity was silently lost. Fixed here.
    //
    // grantRole is additive — a Student registering as TPO keeps their
    // "student" authorization (and every student-track field: totalXP,
    // solvedSlugs, streaks, etc. all stay untouched on this same
    // document); only the ACTIVE role below switches to "tpo". See
    // models/User.js's role/roles comment for why student data isn't
    // moved or cleared here.
    req.userDoc.grantRole("tpo");
    req.userDoc.role = "tpo";
    req.userDoc.tpoProfile = {
      collegeDomain: domain,
      collegeName,
      verified: autoVerified,
      requestedAt: now,
      verifiedAt: autoVerified ? now : null,
    };

    // TPO-1 hardening: partial-failure handling. The College-side write
    // above already committed by this point — if the User-side write
    // fails now, we'd otherwise strand the domain in a half-claimed state
    // with no valid owner (the pending-college 409 guard near the top of
    // this handler would then permanently block every future
    // registration attempt for this domain, since College.findByDomain
    // would keep finding this orphaned record). Roll the College-side
    // change back so the domain returns to its pre-request state and can
    // be retried cleanly. Best-effort (a rollback failure is logged, not
    // thrown over) — there is no fully atomic alternative available in
    // this codebase (no transactions are used anywhere else either; see
    // tpoTeamService.js's CAS-based approach for why single-document
    // atomic operations are preferred where the invariant allows it).
    try {
      await req.userDoc.save();
    } catch (err) {
      if (createdNewCollege) {
        await College.deleteOne({ _id: collegeDoc._id }).catch((rollbackErr) =>
          (req.log || logger).error(
            { err: rollbackErr, collegeId: collegeDoc._id },
            "[TPO] register: failed to roll back newly-created College after User save failure"
          )
        );
      } else if (placeholderSnapshot) {
        await College.updateOne({ _id: collegeDoc._id }, { $set: placeholderSnapshot }).catch((rollbackErr) =>
          (req.log || logger).error(
            { err: rollbackErr, collegeId: collegeDoc._id },
            "[TPO] register: failed to roll back placeholder-upgrade College change after User save failure"
          )
        );
      }
      throw err;
    }

    // ── First verified TPO becomes primary (Phase 3, item 5) ────────────
    // Only ever attempted here for the auto-verified path — a pending TPO
    // isn't verified yet and can't hold primary authority (item 3/18).
    // Pending TPOs get their shot at this when an admin later verifies
    // their college — see adminController.js's approveTpo, which runs the
    // same claim against whichever pending TPO registered earliest. Uses
    // the atomic CAS in tpoTeamService.js rather than a plain "is there a
    // primary yet?" read-then-write, so two people registering for a
    // brand-new domain at nearly the same moment can't both become primary.
    //
    // TPO-1 hardening: this is deliberately isolated in its own try/catch.
    // By this point the User doc is already saved and verified — the core
    // "did registration succeed" outcome is already settled. A failure
    // here (e.g. a transient DB error on the CAS write) must not make an
    // otherwise-successful registration report as a 500 to the person
    // registering. Falling back to isPrimary: false is always a *safe*
    // default per the invariant (rule 4: a college can legitimately have
    // zero primary TPOs temporarily) — it just means this particular
    // attempt didn't claim it, recoverable later via the team endpoints
    // or the next verified registration.
    let isPrimary = false;
    if (autoVerified && collegeDoc) {
      try {
        isPrimary = await claimPrimaryIfNone(collegeDoc._id, req.userDoc._id);
      } catch (err) {
        (req.log || logger).error(
          { err, collegeId: collegeDoc._id, userId: req.userDoc._id },
          "[TPO] register: primary claim failed after successful registration — continuing without primary"
        );
      }
    }

    return res.status(201).json({
      success: true,
      role: "tpo",
      verified: autoVerified,
      status: autoVerified ? "verified" : "pending",
      isPrimary,
      message: autoVerified
        ? "Your college is verified. You're all set — head to your dashboard."
        : "Your college registration request has been submitted for verification.",
    });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] register error");
    return res.status(500).json({ error: "Failed to register as TPO." });
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
            { $match: { emailDomain: { $in: collegeDomains }, role: "student", ...searchMatch } },
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
router.get("/dashboard", requireRole("tpo", "admin"),
  requireVerified, async (req, res) => {
    if (b2bGate(req, res)) return;

    try {


      const domain = req.userDoc.tpoProfile?.collegeDomain;
      if (!domain) return res.status(400).json({ error: "No college domain set." });

      // Multi-domain college fix (TPO-1 closure) — see the matching
      // comment in GET /students above.
      const collegeDomains = await resolveCollegeDomains(req.userDoc);

      const { value: dashboard, cacheStatus } = await getOrSetCache(
        `${TPO_CACHE_PREFIX}dashboard:${domain}`,
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
            { $match: { emailDomain: { $in: collegeDomains }, role: "student" } },
            {
              $facet: {
                summary: [
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
                topicCoverage: [
                  { $unwind: "$topicStats" },
                  {
                    $group: {
                      _id: "$topicStats.topic",
                      totalSolves: { $sum: "$topicStats.count" },
                    },
                  },
                  { $sort: { totalSolves: -1 } },
                  { $limit: 10 },
                  { $project: { _id: 0, topic: "$_id", totalSolves: 1 } },
                ],
              },
            },
          ]);

          const summary = aggResult?.summary?.[0];

          if (!summary || summary.totalStudents === 0) {
            return { totalStudents: 0, message: "No students from your college have joined Code Club yet." };
          }

          const { totalStudents, totalSolved, totalEasy, totalMedium, totalHard, activeThisWeek } = summary;
          const avgSolved = Math.round((totalSolved / totalStudents) * 10) / 10;

          // ── Placement Readiness Score (0-100) ────────────────────────────────
          // Heuristic: weighted combination of average solves, hard-problem coverage,
          // and active engagement. This is the #1 number a TPO will look at.
          const solveScore = Math.min(40, (avgSolved / 100) * 40);           // up to 40 pts for solving 100+ avg
          const hardScore = Math.min(30, ((totalHard / totalStudents) / 20) * 30); // up to 30 pts for 20+ hard avg
          const engagementScore = Math.min(30, (activeThisWeek / totalStudents) * 30);  // up to 30 pts for active streaks
          const readinessScore = Math.round(solveScore + hardScore + engagementScore);

          return {
            totalStudents,
            avgSolved,
            totalSolved,
            difficultyBreakdown: { easy: totalEasy, medium: totalMedium, hard: totalHard },
            activeThisWeek,
            activePercent: Math.round((activeThisWeek / totalStudents) * 100),
            readinessScore,
            topicCoverage: aggResult?.topicCoverage ?? [],
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


    const { title, problemSlugs, dueDate } = req.body;

    if (!title || !Array.isArray(problemSlugs) || problemSlugs.length === 0 || !dueDate) {
      return res.status(400).json({ error: "title, problemSlugs (array), and dueDate are required." });
    }

    const assignment = await Assignment.create({
      tpoId: req.userDoc._id,
      collegeDomain: req.userDoc.tpoProfile?.collegeDomain,
      title,
      problemSlugs,
      dueDate: new Date(dueDate),
    });

    // Fan out a notification to every student in the college. Fire-and-forget
    // — a notification hiccup shouldn't fail assignment creation, which has
    // already succeeded. Uses insertMany under the hood (via
    // createNotificationBulk), so this stays cheap even for a large roster.
    const domain = req.userDoc.tpoProfile?.collegeDomain;
    if (domain) {
      User.find({
        emailDomain: domain.toLowerCase(),
        role: "student",
      })
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


    const assignments = await Assignment.find({
      collegeDomain: req.userDoc.tpoProfile?.collegeDomain,
    })
      .sort({ dueDate: -1 })
      .lean();

    // Compute completion % per assignment
    const domain = req.userDoc.tpoProfile?.collegeDomain;
    if (!domain) return res.status(400).json({ error: "No college domain set on this TPO account." });
    const students = await User.find({
      emailDomain: domain.toLowerCase(),
      role: "student",
    }).select("solvedSlugs").lean();

    const totalStudents = students.length || 1;

    const enriched = assignments.map(a => {
      const completedCount = students.filter(s =>
        a.problemSlugs.every(slug => (s.solvedSlugs || []).includes(slug))
      ).length;

      return {
        ...a,
        completedCount,
        totalStudents,
        completionPercent: Math.round((completedCount / totalStudents) * 100),
        isOverdue: new Date(a.dueDate) < new Date(),
      };
    });

    return res.json({ assignments: enriched });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] list assignments error");
    return res.status(500).json({ error: "Failed to load assignments." });
  }
});

// ── POST /api/tpo/assignments/:id/remind ────────────────────────────────────
// Nudges every student on this college's roster who hasn't completed the
// assignment yet. Reuses the same createNotificationBulk fan-out the
// assignment-creation flow already uses for consistency. Extracted as a
// named function (rather than inline, like handleCreateInterest in
// recruiter.js) so it can be unit-tested directly.
export async function handleRemindAssignment(req, res) {
  if (b2bGate(req, res)) return;

  try {
    const domain = req.userDoc.tpoProfile?.collegeDomain;
    if (!domain) return res.status(400).json({ error: "No college domain set on this TPO account." });

    const assignment = await Assignment.findOne({
      _id: req.params.id,
      collegeDomain: domain,
    }).lean();
    if (!assignment) return res.status(404).json({ error: "Assignment not found." });

    const students = await User.find({
      emailDomain: domain.toLowerCase(),
      role: "student",
    }).select("_id solvedSlugs").lean();

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

// ── GET /api/assignments/student ────────────────────────────────────────────
// Student view: assignments relevant to their college, with their own progress.
// Mounted separately (not /api/tpo/* — students aren't TPOs).
export const studentAssignmentsRouter = Router();

studentAssignmentsRouter.get("/", async (req, res) => {
  if (!B2B_ENABLED) return res.json({ enabled: false, assignments: [] });

  try {
    if (!req.userDoc?.email) return res.json({ assignments: [] });

    const domain = req.userDoc.email.split("@")[1];
    const assignments = await Assignment.find({ collegeDomain: domain })
      .sort({ dueDate: 1 })
      .lean();

    const solvedSet = new Set(req.userDoc.solvedSlugs || []);

    const enriched = assignments.map(a => {
      const solvedCount = a.problemSlugs.filter(slug => solvedSet.has(slug)).length;
      return {
        _id: a._id,
        title: a.title,
        dueDate: a.dueDate,
        problemSlugs: a.problemSlugs,
        solvedCount,
        totalProblems: a.problemSlugs.length,
        isComplete: solvedCount === a.problemSlugs.length,
        isOverdue: new Date(a.dueDate) < new Date(),
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


      const domain = req.userDoc.tpoProfile?.collegeDomain;
      if (!domain) return res.status(400).json({ error: "No college domain set on this TPO account." });
      // Multi-domain college fix (TPO-1 closure) — see the matching
      // comment in GET /students above.
      const collegeDomains = await resolveCollegeDomains(req.userDoc);
      const students = await User.find({
        emailDomain: { $in: collegeDomains },
        role: "student",
      })
        .select("displayName totalXP solvedSlugs solvedDifficulty currentStreak topicStats")
        .sort({ totalXP: -1 })
        .lean();

      const totalStudents = students.length;
      const totalSolved = students.reduce((sum, s) => sum + (s.solvedSlugs?.length ?? 0), 0);
      const avgSolved = totalStudents ? Math.round((totalSolved / totalStudents) * 10) / 10 : 0;
      const activeCount = students.filter(s => (s.currentStreak ?? 0) > 0).length;

      const doc = new PDFDocument({ size: "A4", margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${(req.userDoc.tpoProfile?.collegeName || "college").replace(/[^a-z0-9]/gi, "_")}_codeclub_report.pdf"`);
      doc.pipe(res);

      // Header
      doc.rect(0, 0, doc.page.width, 90).fill("#18181b");
      doc.fontSize(22).fillColor("#22c55e").font("Helvetica-Bold").text("Code Club", 50, 24);
      doc.fontSize(11).fillColor("#a1a1aa").font("Helvetica").text("Class Performance Report", 50, 52);
      doc.fontSize(10).fillColor("#71717a")
        .text(new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), doc.page.width - 200, 52, { align: "right", width: 150 });

      doc.fontSize(18).fillColor("#000").font("Helvetica-Bold").text(req.userDoc.tpoProfile?.collegeName || "College", 50, 110);
      doc.fontSize(10).fillColor("#71717a").font("Helvetica").text(domain, 50, 134);

      // Summary stats
      let sy = 165;
      const summary = [
        { label: "Total Students", value: totalStudents },
        { label: "Avg Problems Solved", value: avgSolved },
        { label: "Active This Week", value: `${activeCount} (${totalStudents ? Math.round(activeCount / totalStudents * 100) : 0}%)` },
        { label: "Total Problems Solved", value: totalSolved },
      ];
      let sx = 50;
      summary.forEach(s => {
        doc.rect(sx, sy, 120, 50).fill("#f4f4f5");
        doc.fontSize(18).fillColor("#16a34a").font("Helvetica-Bold").text(String(s.value), sx + 10, sy + 8);
        doc.fontSize(8).fillColor("#71717a").font("Helvetica").text(s.label, sx + 10, sy + 30, { width: 100 });
        sx += 130;
      });

      // Student table
      let ty = sy + 75;
      doc.fontSize(12).fillColor("#000").font("Helvetica-Bold").text("STUDENT RANKINGS", 50, ty);
      ty += 22;

      doc.fontSize(8).fillColor("#71717a").font("Helvetica-Bold");
      doc.text("Rank", 50, ty); doc.text("Name", 90, ty); doc.text("Solved", 320, ty);
      doc.text("Streak", 380, ty); doc.text("XP", 450, ty);
      ty += 14;
      doc.moveTo(50, ty).lineTo(doc.page.width - 50, ty).strokeColor("#e4e4e7").stroke();
      ty += 8;

      students.slice(0, 40).forEach((s, i) => {
        if (ty > doc.page.height - 60) { doc.addPage(); ty = 50; }
        doc.fontSize(8).fillColor("#3f3f46").font("Helvetica");
        doc.text(String(i + 1), 50, ty);
        doc.text(s.displayName || "—", 90, ty, { width: 220 });
        doc.text(String(s.solvedSlugs?.length ?? 0), 320, ty);
        doc.text(String(s.currentStreak ?? 0), 380, ty);
        doc.text(String(s.totalXP ?? 0), 450, ty);
        ty += 16;
      });

      // Footer
      const footerY = doc.page.height - 40;
      doc.fontSize(8).fillColor("#a1a1aa").text(`Generated by Code Club · ${SITE_URL.replace("https://","")}`, 50, footerY, { align: "center", width: doc.page.width - 100 });

      doc.end();
    } catch (err) {
      (req.log || logger).error({ err }, "[TPO] report PDF error");
      if (!res.headersSent) res.status(500).json({ error: "Failed to generate report." });
    }
  });

export default router;