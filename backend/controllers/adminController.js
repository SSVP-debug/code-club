/**
 * Admin controller.
 *
 * Extracted from routes/admin.js (Staff review §2/§9: routes/admin.js was
 * one of the large inline-logic route files with no controller behind it).
 * Behavior is unchanged from the previous inline handlers — this is a pure
 * move, plus swapping the ad-hoc `console.error` calls for the structured
 * `logger` used elsewhere in controllers/ (review §9/#18), so these lines
 * get the same redaction/aggregation as the rest of the app's logs.
 *
 * Verification queue (Phase B):
 *   GET  /api/admin/pending
 *   POST /api/admin/recruiters/:id/approve | /reject
 *   POST /api/admin/tpo/:collegeId/approve | /reject
 *
 * Impersonation — "Login As":
 *   GET  /api/admin/users                    — searchable/paginated user list
 *   POST /api/admin/impersonate/:userId       — start viewing as that user
 *   POST /api/admin/impersonate/stop          — return to your own admin session
 *
 * Every route this backs uses requireAdmin (not requireRole("admin")) — see
 * middleware/roleGuard.js for why: while impersonating, req.userDoc.role
 * reflects the *target's* role by design, so a plain requireRole("admin")
 * would lock you out of switching targets or exiting.
 */
import College from "../models/College.js";
import User from "../models/User.js";
import ImpersonationLog from "../models/ImpersonationLog.js";
import AdminAuditLog from "../models/AdminAuditLog.js";
import Submission from "../models/Submission.js";
import Notification from "../models/Notification.js";
import Problem from "../models/Problem.js";
import { createNotification } from "../services/notificationService.js";
import { recordAdminAction } from "../services/adminAuditLog.js";
import { invalidateCachedUserByFirebaseUid } from "../utils/userAuthCache.js";
import { logger } from "../config/logger.js";
import { claimPrimaryIfNone, clearPrimaryIfCurrent } from "../services/tpoTeamService.js";
import TpoVerificationReview from "../models/TpoVerificationReview.js";

const RECRUITER_QUEUE_FIELDS = "email displayName recruiterProfile createdAt";

// ── GET /api/admin/pending ──────────────────────────────────────────────────
export async function getPendingQueue(req, res) {
  try {
    const [recruiters, pendingColleges, pendingTpoUsers] = await Promise.all([
      User.find(
        { role: "recruiter", "recruiterProfile.verified": false },
        RECRUITER_QUEUE_FIELDS
      )
        .sort({ createdAt: 1 })
        .lean(),
      // Pending College docs come from two submitter paths — TPO
      // registration and student college-email verification — mixed in the
      // same collection and split below by submittedByRole so the queue
      // can render/label them separately.
      College.find({ status: "pending" })
        .populate("submittedBy", "email displayName tpoVerification")
        .sort({ createdAt: 1 })
        .lean(),
      User.find(
        { role: "tpo", "tpoProfile.verified": false, "tpoVerification.status": "pending" },
        "email displayName tpoProfile tpoVerification createdAt"
      )
        .sort({ "tpoProfile.requestedAt": 1, createdAt: 1 })
        .lean(),
    ]);

    const tpoColleges = pendingColleges.filter((c) => c.submittedByRole === "tpo");
    // "auto" (signup-time auto-detected — services/collegeAutoProvision.js)
    // bucketed together with "student" here: same review flow
    // (approve/rejectStudentCollege), same admin queue. No human
    // submitted an "auto" record, so requestedBy will just be null for
    // those — the frontend labels them "Auto-detected" instead of a
    // requester name (see AdminOverviewPage.jsx).
    const pendingCollegeRequesterIds = new Set(
      tpoColleges.map((c) => c.submittedBy?._id?.toString()).filter(Boolean)
    );
    const individualTpoRequests = pendingTpoUsers.filter(
      (u) => !pendingCollegeRequesterIds.has(u._id.toString())
    );

    const studentColleges = pendingColleges.filter(
      (c) => c.submittedByRole === "student" || c.submittedByRole === "auto"
    );

    return res.json({
      recruiters: recruiters.map((u) => ({
        id: u._id,
        email: u.email,
        displayName: u.displayName,
        companyName: u.recruiterProfile?.companyName,
        designation: u.recruiterProfile?.designation,
        companyDomain: u.recruiterProfile?.companyDomain,
        requestedAt: u.createdAt,
      })),
      tpos: [
        ...tpoColleges.map((c) => {
        const applicant = c.submittedBy && typeof c.submittedBy === "object"
          ? c.submittedBy
          : null;
        const signal = applicant?.tpoVerification?.emailRoleSignal || "unknown";
        return {
          collegeId: c._id,
          collegeName: c.name,
          // Keep the legacy first-domain field for existing admin clients while
          // exposing the complete configured domain list.
          domain: c.domains?.[0],
          domains: c.domains,
          requestedBy: applicant
            ? { email: applicant.email, displayName: applicant.displayName }
            : null,
          requestedAt: applicant?.tpoVerification?.submittedAt || c.createdAt,
          emailRoleSignal: signal,
          verificationStatus: applicant?.tpoVerification?.status || "pending",
          additionalEvidenceRecommended: signal !== "staff_candidate",
          evidence: applicant?.tpoVerification?.evidence || [],
        };
        }),
        ...individualTpoRequests.map((u) => ({
          userId: u._id,
          collegeId: null,
          collegeName: u.tpoProfile?.collegeName || "Unknown college",
          domain: u.tpoProfile?.collegeDomain,
          domains: u.tpoProfile?.collegeDomain ? [u.tpoProfile.collegeDomain] : [],
          requestedBy: { email: u.email, displayName: u.displayName },
          requestedAt: u.tpoVerification?.submittedAt || u.tpoProfile?.requestedAt || u.createdAt,
          emailRoleSignal: u.tpoVerification?.emailRoleSignal || "unknown",
          verificationStatus: u.tpoVerification?.status || "pending",
          additionalEvidenceRecommended: (u.tpoVerification?.emailRoleSignal || "unknown") !== "staff_candidate",
          evidence: u.tpoVerification?.evidence || [],
          reviewTarget: "user",
        })),
      ],
      studentCollegeRequests: studentColleges.map((c) => ({
        collegeId: c._id,
        collegeName: c.name,
        domains: c.domains,
        website: c.website,
        autoDetected: c.submittedByRole === "auto",
        requestedBy: c.submittedBy
          ? { email: c.submittedBy.email, displayName: c.submittedBy.displayName }
          : null,
        requestedAt: c.createdAt,
      })),
    });
  } catch (err) {
    logger.error({ err }, "[Admin] pending queue error");
    return res.status(500).json({ error: "Failed to load pending queue." });
  }
}

// ── POST /api/admin/recruiters/:id/approve ──────────────────────────────────
export async function approveRecruiter(req, res) {
  try {
    const user = await User.findById(req.params.id);

    if (!user || user.role !== "recruiter") {
      return res.status(404).json({ error: "Recruiter not found." });
    }

    user.recruiterProfile.verified = true;
    user.recruiterProfile.verifiedAt = new Date();
    await user.save();
    // This user's own requireAuth cache entry (on whichever instance they
    // next hit) would otherwise still show `verified: false` for up to
    // AUTH_USER_CACHE_TTL_MS — drop it on this instance now so a request
    // that happens to land here sees the fresh doc immediately.
    invalidateCachedUserByFirebaseUid(user.firebaseUid);

    recordAdminAction({
      adminDoc: req.actingAdminDoc || req.userDoc,
      action: "recruiter.approve",
      targetType: "User",
      targetId: user._id,
    });

    createNotification({
      userId: user._id,
      type: "recruiter_verified",
      title: "Recruiter access approved",
      message: `You're verified for ${user.recruiterProfile.companyName}. Your dashboard is ready.`,
      link: "/recruiter/dashboard",
    }).catch(() => {});

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Admin] approve recruiter error");
    return res.status(500).json({ error: "Failed to approve recruiter." });
  }
}

// ── POST /api/admin/recruiters/:id/reject ───────────────────────────────────
export async function rejectRecruiter(req, res) {
  try {
    const user = await User.findById(req.params.id);

    if (!user || user.role !== "recruiter") {
      return res.status(404).json({ error: "Recruiter not found." });
    }

    const companyName = user.recruiterProfile?.companyName;

    // Revoke the "recruiter" authorization (not just the active role) so
    // this account can no longer switch back into a recruiter session via
    // POST /me/switch-role — matches the additive grantRole() at
    // registration. Falls active role back to "student", which every
    // account is authorized for by default.
    user.revokeRole("recruiter");
    user.role = "student";
    user.recruiterProfile = {
      companyName: null,
      designation: null,
      companyDomain: null,
      verified: false,
      verifiedAt: null,
    };
    await user.save();
    invalidateCachedUserByFirebaseUid(user.firebaseUid);

    recordAdminAction({
      adminDoc: req.actingAdminDoc || req.userDoc,
      action: "recruiter.reject",
      targetType: "User",
      targetId: user._id,
    });

    createNotification({
      userId: user._id,
      type: "recruiter_rejected",
      title: "Recruiter access request declined",
      message: companyName
        ? `We couldn't verify your request for ${companyName}. Reach out if this was a mistake.`
        : "We couldn't verify your recruiter access request.",
      link: "/recruiter/signup",
    }).catch(() => {});

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Admin] reject recruiter error");
    return res.status(500).json({ error: "Failed to reject recruiter." });
  }
}

// Shared by approveTpo/rejectTpo and approveStudentCollege/rejectStudentCollege
// — flips the institution's own trust state. Callers are responsible for
// whatever role-specific follow-up (tpoProfile sync, education.collegeStatus
// sync) their submitter type needs.
async function setCollegeStatus(collegeId, status) {
  const college = await College.findById(collegeId);
  if (!college) return null;
  college.status = status;
  college.verifiedAt = status === "verified" ? new Date() : null;
  await college.save();
  return college;
}

// ── POST /api/admin/tpo/:collegeId/approve ──────────────────────────────────
export async function approveTpo(req, res) {
  try {
    // Institution approval and individual TPO authorization are deliberately
    // separate decisions. Approving the College establishes institutional
    // trust; it must never bulk-verify every TPO requester.
    const college = await setCollegeStatus(req.params.collegeId, "verified");
    if (!college) return res.status(404).json({ error: "College request not found." });

    recordAdminAction({
      adminDoc: req.actingAdminDoc || req.userDoc,
      action: "tpo.approve",
      targetType: "College",
      targetId: college._id,
    });

    if (college.submittedBy) {
      createNotification({
        userId: college.submittedBy,
        type: "college_verified",
        title: "College verified",
        message: college.name + " is verified. Individual TPO requests still require review.",
        link: "/tpo/dashboard",
      }).catch(() => {});
    }

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Admin] approve TPO error");
    return res.status(500).json({ error: "Failed to approve TPO." });
  }
}

// ── POST /api/admin/tpo/:collegeId/reject ───────────────────────────────────
export async function rejectTpo(req, res) {
  try {
    const college = await College.findById(req.params.collegeId);
    if (!college) return res.status(404).json({ error: "College request not found." });

    const requesterId = college.submittedBy;
    const collegeName = college.name;
    const requester = requesterId
      ? await User.findById(requesterId)
      : null;

    const reviewerId = req.actingAdminDoc?._id || req.userDoc?._id;
    if (reviewerId && requester) {
      try {
        await TpoVerificationReview.create({
          userId: requester._id,
          collegeId: college._id,
          requestedEmail: requester.tpoVerification?.submittedEmail || requester.email || "",
          emailRoleSignal: requester.tpoVerification?.emailRoleSignal || "unknown",
          evidence: requester.tpoVerification?.evidence || [],
          decision: "rejected",
          decisionReason: "TPO request rejected through the administrative verification queue.",
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
        });
      } catch (err) {
        logger.error(
          { err, collegeId: college._id },
          "[Admin] rejectTpo: failed to persist verification review audit"
        );
      }
    }

    await College.deleteOne({ _id: college._id });

    recordAdminAction({
      adminDoc: req.actingAdminDoc || req.userDoc,
      action: "tpo.reject",
      targetType: "College",
      targetId: college._id,
    });

    if (requester && requester.role === "tpo") {
      requester.revokeRole("tpo");
      requester.role = "student";
      requester.tpoProfile = {
        collegeDomain: null,
        collegeName: null,
        verified: false,
        requestedAt: null,
        verifiedAt: null,
      };
      requester.tpoVerification = {
        ...(requester.tpoVerification || {}),
        status: "rejected",
        emailRoleSignal: requester.tpoVerification?.emailRoleSignal || "unknown",
        submittedEmail: requester.tpoVerification?.submittedEmail || requester.email || null,
        submittedAt: requester.tpoVerification?.submittedAt || null,
        evidence: requester.tpoVerification?.evidence || [],
      };
      await requester.save();
      invalidateCachedUserByFirebaseUid(requester.firebaseUid);

      createNotification({
        userId: requesterId,
        type: "tpo_rejected",
        title: "TPO access request declined",
        message: "We couldn't verify your request for " + collegeName + ". Reach out if this was a mistake.",
        link: "/tpo/signup",
      }).catch(() => {});
    }

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Admin] reject TPO error");
    return res.status(500).json({ error: "Failed to reject TPO request." });
  }
}


// ── POST /api/admin/student-colleges/:collegeId/approve ────────────────────
// Approves a college that was requested via a student's college-email
// verification (backend/routes/collegeVerification.js), as opposed to a TPO
// registration. Pushes the new status to every user whose education is
// linked to this college and has already verified their email — mirrors the
// tpoProfile-sync pattern in approveTpo above, applied to `education`.
export async function approveStudentCollege(req, res) {
  try {
    const college = await setCollegeStatus(req.params.collegeId, "verified");
    if (!college) {
      return res.status(404).json({ error: "College request not found." });
    }

    const affected = await User.find({
      "education.collegeId": college._id,
      "education.emailVerified": true,
    });

    await Promise.all(
      affected.map((u) => {
        u.education.collegeStatus = "verified";
        return u.save();
      })
    );

    affected.forEach((u) => invalidateCachedUserByFirebaseUid(u.firebaseUid));

    recordAdminAction({
      adminDoc: req.actingAdminDoc || req.userDoc,
      action: "studentCollege.approve",
      targetType: "College",
      targetId: college._id,
    });

    affected.forEach((u) =>
      createNotification({
        userId: u._id,
        type: "college_verified",
        title: "Your college is now verified",
        message: `${college.name} has been added to Code Club's verified colleges. Your College Leaderboard is unlocked.`,
        link: "/club/leaderboard",
      }).catch(() => {})
    );

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Admin] approve student college error");
    return res.status(500).json({ error: "Failed to approve college." });
  }
}

// ── POST /api/admin/student-colleges/:collegeId/reject ──────────────────────
// Unlike rejectTpo, this does NOT delete the College doc — the record is
// kept with status:"rejected" so a resubmission for the same domain is
// recognized as "already reviewed" (see the 409 check in
// collegeVerification.js's findOrCreatePendingCollege) rather than silently
// re-queuing a previously-rejected institution.
export async function rejectStudentCollege(req, res) {
  try {
    const college = await setCollegeStatus(req.params.collegeId, "rejected");
    if (!college) {
      return res.status(404).json({ error: "College request not found." });
    }

    const affected = await User.find({
      "education.collegeId": college._id,
      "education.emailVerified": true,
    });

    await Promise.all(
      affected.map((u) => {
        u.education.collegeStatus = "rejected";
        return u.save();
      })
    );

    affected.forEach((u) => invalidateCachedUserByFirebaseUid(u.firebaseUid));

    recordAdminAction({
      adminDoc: req.actingAdminDoc || req.userDoc,
      action: "studentCollege.reject",
      targetType: "College",
      targetId: college._id,
    });

    affected.forEach((u) =>
      createNotification({
        userId: u._id,
        type: "college_rejected",
        title: "College verification update",
        message: `We weren't able to verify ${college.name} for official College Leaderboard status. Your email verification is unaffected.`,
        link: "/profile",
      }).catch(() => {})
    );

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Admin] reject student college error");
    return res.status(500).json({ error: "Failed to reject college." });
  }
}

// ── GET /api/admin/users ─────────────────────────────────────────────────────
// Searchable, paginated user list backing the "Login As" table. Admin
// accounts are excluded entirely — impersonating another admin isn't a
// supported flow (see the guard in startImpersonation too).
export async function listUsers(req, res) {
  try {
    const { role, search, college, page = 1, limit = 20 } = req.query;

    const andClauses = [{ role: { $ne: "admin" } }];
    if (role && ["student", "recruiter", "tpo"].includes(role)) {
      andClauses.push({ role });
    }
    if (search) {
      andClauses.push({
        $or: [
          { displayName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { username: { $regex: search, $options: "i" } },
        ],
      });
    }
    // Plan 005's "View students" deep-link: ?college=<collegeId>. Matches
    // either linkage mechanism (see collegeController.js's getColleges for
    // the same two-mechanism reasoning) — a student via education.collegeId,
    // or a TPO via tpoProfile.collegeDomain against this college's domains.
    // Recruiters/admins can never match either branch, so they're naturally
    // excluded without a separate role check.
    if (college) {
      const collegeDoc = await College.findById(college).lean();
      if (!collegeDoc) {
        return res.status(404).json({ error: "College not found." });
      }
      andClauses.push({
        $or: [
          { "education.collegeId": collegeDoc._id },
          { "tpoProfile.collegeDomain": { $in: collegeDoc.domains } },
        ],
      });
    }

    const filter = andClauses.length > 1 ? { $and: andClauses } : andClauses[0];

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, parseInt(limit));

    const [users, total] = await Promise.all([
      User.find(
        filter,
        "displayName email username role status recruiterProfile.companyName recruiterProfile.verified tpoProfile.collegeName tpoProfile.verified createdAt"
      )
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    return res.json({
      users: users.map((u) => ({
        id: u._id,
        displayName: u.displayName,
        email: u.email,
        username: u.username,
        role: u.role,
        status: u.status || "active",
        label:
          u.role === "recruiter"
            ? u.recruiterProfile?.companyName
            : u.role === "tpo"
            ? u.tpoProfile?.collegeName
            : null,
        verified:
          u.role === "recruiter"
            ? Boolean(u.recruiterProfile?.verified)
            : u.role === "tpo"
            ? Boolean(u.tpoProfile?.verified)
            : true,
        joinedAt: u.createdAt,
      })),
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    logger.error({ err }, "[Admin] users list error");
    return res.status(500).json({ error: "Failed to load users." });
  }
}

// ── GET /api/admin/audit-logs ────────────────────────────────────────────────
// Paginated, filterable read of the durable admin-action trail written by
// services/adminAuditLog.js's recordAdminAction(...). Append-only — there is
// no corresponding update/delete route.
export async function getAuditLogs(req, res) {
  try {
    const { action, adminId, startDate, endDate, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (action) filter.action = action;
    if (adminId) filter.adminId = adminId;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, parseInt(limit));

    const [logs, total] = await Promise.all([
      AdminAuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      AdminAuditLog.countDocuments(filter),
    ]);

    return res.json({
      logs,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    logger.error({ err }, "[Admin] audit logs error");
    return res.status(500).json({ error: "Failed to load audit logs." });
  }
}

// ── GET /api/admin/dashboard-metrics ─────────────────────────────────────────
// Single response, all metrics — the frontend renders them together as a
// grid of stat cards (plan 004), no reason to round-trip once per card.
// Current-state snapshot only (no time-series/trends — that's plan 007).
//
// "Active" per role uses status: "active" (plan 003's User.status field,
// already landed by the time this was written — no fallback needed).
//
// Total Problems mirrors getProblems' (problemController.js) own catalog
// visibility filter exactly (`visibility: { $ne: "contest" }`) so this
// number always matches what the public problem list would show, not an
// internal total that includes contest-only problems.
//
// Submission counts / acceptance rate read the same Submission collection
// and "status === 'Accepted'" semantics as getAcceptanceRates
// (problemController.js) — same source of truth, collapsed to a single
// platform-wide number instead of per-problem. This is a plain
// Submission collection with a flat status field (not denormalized
// per-problem stats), so a platform-wide count is cheap and accurate —
// no escape-hatch situation here.
//
// Pending recruiter/TPO approvals mirror getPendingQueue's two query
// branches above, collapsed to countDocuments instead of find + full
// document fetch.
export async function getDashboardMetrics(req, res) {
  try {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const [
      totalStudents,
      totalRecruiters,
      totalTpos,
      activeStudents,
      activeRecruiters,
      activeTpos,
      newRegistrationsToday,
      totalProblems,
      totalSubmissions,
      acceptedSubmissions,
      pendingRecruiterApprovals,
      pendingTpoApprovals,
    ] = await Promise.all([
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "recruiter" }),
      User.countDocuments({ role: "tpo" }),
      User.countDocuments({ role: "student", status: "active" }),
      User.countDocuments({ role: "recruiter", status: "active" }),
      User.countDocuments({ role: "tpo", status: "active" }),
      User.countDocuments({ createdAt: { $gte: startOfToday } }),
      Problem.countDocuments({ visibility: { $ne: "contest" } }),
      Submission.countDocuments({}),
      Submission.countDocuments({ status: "Accepted" }),
      User.countDocuments({ role: "recruiter", "recruiterProfile.verified": false }),
      College.countDocuments({ status: "pending", submittedByRole: "tpo" }),
    ]);

    const acceptanceRate =
      totalSubmissions > 0 ? Math.round((acceptedSubmissions / totalSubmissions) * 100) : 0;

    return res.json({
      users: {
        totalStudents,
        totalRecruiters,
        totalTpos,
        activeStudents,
        activeRecruiters,
        activeTpos,
        newRegistrationsToday,
      },
      content: {
        totalProblems,
        totalSubmissions,
        acceptanceRate,
      },
      approvals: {
        pendingRecruiterApprovals,
        pendingTpoApprovals,
      },
    });
  } catch (err) {
    logger.error({ err }, "[Admin] dashboard metrics error");
    return res.status(500).json({ error: "Failed to load dashboard metrics." });
  }
}

// ── User management actions (plan 003) ───────────────────────────────────────
// Every action below: validates target exists and isn't an admin, performs
// its mutation, invalidates the auth cache so it takes effect immediately
// (not after the cache TTL), and audit-logs via recordAdminAction (plan 002).

// The "progress" field list for resetUserProgress, enumerated from the full
// User schema (backend/models/User.js) per plan 003's instruction not to
// guess field names. Split into what's unambiguously progress (reset) vs.
// what's ambiguous enough that this plan deliberately leaves untouched
// rather than guess — see the comment above PROGRESS_RESET_FIELDS below.
const PROGRESS_RESET_FIELDS = {
  currentStreak: 0,
  longestStreak: 0,
  lastActivityDate: null,
  totalXP: 0,
  solvedSlugs: [],
  solvedDifficulty: { easy: 0, medium: 0, hard: 0 },
  topicStats: {},
  activityDates: [],
  recentActivity: [],
  achievements: [],
  dailyChallengeHistory: [],
};
// Deliberately NOT included above, flagged as ambiguous rather than guessed
// (escape hatch, plan 003): profileSignature (derived hash OF solvedCount —
// resetting solved data without it leaves a stale/inconsistent signature,
// but it's arguably a "profile" artifact, not progress itself); certificates
// (earned via completing tracks — progress-shaped, but the plan named only
// "achievements" explicitly, not this); pinnedProblems (user's curated
// showcase of solved problems — a curation choice, but references solved
// data); leetcodeStats (explicitly documented elsewhere in this file's model
// as NOT fed into totalXP/solvedSlugs, manually-entered supplementary
// content — leans profile); problemNotes (personal annotations on problems —
// could be either). None of these are touched by resetUserProgress below.
export async function suspendUser(req, res) {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ error: "User not found." });
    }
    if (target.role === "admin") {
      return res.status(400).json({ error: "Admins can't be suspended." });
    }

    target.status = "suspended";
    await target.save();
    invalidateCachedUserByFirebaseUid(target.firebaseUid);

    recordAdminAction({
      adminDoc: req.actingAdminDoc || req.userDoc,
      action: "user.suspend",
      targetType: "User",
      targetId: target._id,
    });

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Admin] suspendUser error");
    return res.status(500).json({ error: "Failed to suspend user." });
  }
}

export async function activateUser(req, res) {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ error: "User not found." });
    }
    if (target.role === "admin") {
      return res.status(400).json({ error: "Admins don't have a status to activate." });
    }

    target.status = "active";
    await target.save();
    invalidateCachedUserByFirebaseUid(target.firebaseUid);

    recordAdminAction({
      adminDoc: req.actingAdminDoc || req.userDoc,
      action: "user.activate",
      targetType: "User",
      targetId: target._id,
    });

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Admin] activateUser error");
    return res.status(500).json({ error: "Failed to activate user." });
  }
}

// Cascade decisions (grep -rn 'ref: "User"' backend/models/, done at
// planning time — see plan 003's maintenance note: revisit this if a new
// model starts referencing User):
//   - Submission, Notification: cascade-deleted below. Both are meaningless
//     without the owning user and, for Submission especially, leaving them
//     orphaned would pollute leaderboards/analytics with phantom entries.
//   - Everything else (Playlist, SkillsTest, RecruiterInterest, College,
//     Contest, Reflection, Assignment, Ambassador, ImpersonationLog,
//     AdminAuditLog, BattleRoom): left orphaned-but-harmless on purpose.
//     Several of these are audit/historical records (ImpersonationLog,
//     AdminAuditLog, SkillsTest) that should arguably survive their
//     subject's deletion for accountability reasons, not be scrubbed by it.
//     User.impersonating.targetUserId pointing at a deleted user is already
//     self-healing — see middleware/auth.js's stale-pointer cleanup, which
//     runs lazily on the admin's next request and needs no extra handling
//     here.
//   - College.primaryTpo (Phase 3, added after this cascade table was
//     written): DOES need explicit handling, unlike the "orphaned but
//     harmless" refs above — an ObjectId reference is technically still
//     "harmless" sitting on a College doc, but every primary-only TPO
//     team action (routes/tpo.js) resolves it via College.findOneAndUpdate
//     CAS keyed on it, and there's no way to distinguish "primary account
//     was deleted" from "primary account exists but the query missed it."
//     Cleared here so the college falls back to "no primary yet" — the
//     same safe, explicit state a college in "not claimed yet" already
//     uses (tpoTeamService.js's claimPrimaryIfNone) — rather than an admin
//     needing to notice and fix a silently-broken team page. No auto-
//     promotion of a replacement primary happens here on purpose (item 6:
//     don't silently invent ownership) — the next verified TPO to be
//     approved (approveTpo above) or an existing verified secondary via
//     the team UI can claim it.
export async function deleteUser(req, res) {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ error: "User not found." });
    }
    if (target.role === "admin") {
      return res.status(400).json({ error: "Admins can't be deleted." });
    }

    const { firebaseUid, _id } = target;
    const tpoCollegeDomain = target.tpoProfile?.collegeDomain || null;

    await Promise.all([
      Submission.deleteMany({ userId: _id }),
      Notification.deleteMany({ userId: _id }),
    ]);
    await User.deleteOne({ _id });

    // TPO-1 hardening: reordered to run AFTER the account is actually
    // gone, not before. This used to run first — if the deletion below
    // then failed partway (a real possibility Promise.all/deleteOne can
    // hit), a still-existing, still-valid primary TPO would have their
    // primary status silently stripped for no reason, while continuing
    // to exist and believing themselves still primary (every primary-
    // only action they take would then wrongly 403). Clearing it after
    // deletion instead means a failure in THIS step leaves a dangling
    // primaryTpo reference — but that degrades into the same "no primary
    // yet" state the rest of the system already handles safely (rule 4),
    // recoverable via the team endpoints' admin override, rather than
    // wrongly demoting someone who was never actually deleted. Best-
    // effort and isolated in its own try/catch for the same reason: the
    // account deletion itself already succeeded by this point and must
    // be reported as success regardless of this cleanup step's outcome.
    if (tpoCollegeDomain) {
      try {
        const college = await College.findByDomain(tpoCollegeDomain);
        if (college) await clearPrimaryIfCurrent(college._id, _id);
      } catch (err) {
        logger.error(
          { err, userId: _id.toString() },
          "[Admin] deleteUser: failed to clear dangling primaryTpo reference after successful deletion"
        );
      }
    }

    invalidateCachedUserByFirebaseUid(firebaseUid);

    recordAdminAction({
      adminDoc: req.actingAdminDoc || req.userDoc,
      action: "user.delete",
      targetType: "User",
      targetId: _id,
    });

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Admin] deleteUser error");
    return res.status(500).json({ error: "Failed to delete user." });
  }
}

export async function resetUserProgress(req, res) {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ error: "User not found." });
    }
    if (target.role === "admin") {
      return res.status(400).json({ error: "Admins don't have progress to reset." });
    }

    Object.assign(target, PROGRESS_RESET_FIELDS);
    await target.save();
    invalidateCachedUserByFirebaseUid(target.firebaseUid);

    recordAdminAction({
      adminDoc: req.actingAdminDoc || req.userDoc,
      action: "user.reset_progress",
      targetType: "User",
      targetId: target._id,
    });

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Admin] resetUserProgress error");
    return res.status(500).json({ error: "Failed to reset user progress." });
  }
}

const CHANGEABLE_ROLES = ["student", "recruiter", "tpo"];

export async function changeUserRole(req, res) {
  try {
    const { role: newRole } = req.body || {};

    if (!CHANGEABLE_ROLES.includes(newRole)) {
      return res.status(400).json({
        error: `Role must be one of: ${CHANGEABLE_ROLES.join(", ")}.`,
      });
    }

    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ error: "User not found." });
    }
    if (target.role === "admin") {
      return res.status(400).json({ error: "Admins' roles can't be changed here." });
    }

    const previousRole = target.role;
    target.role = newRole;
    await target.save();
    invalidateCachedUserByFirebaseUid(target.firebaseUid);

    recordAdminAction({
      adminDoc: req.actingAdminDoc || req.userDoc,
      action: "user.change_role",
      targetType: "User",
      targetId: target._id,
      details: { previousRole, newRole },
    });

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Admin] changeUserRole error");
    return res.status(500).json({ error: "Failed to change user role." });
  }
}

// ── POST /api/admin/impersonate/:userId ─────────────────────────────────────
export async function startImpersonation(req, res) {
  try {
    // req.actingAdminDoc is only set while already impersonating (switching
    // targets directly); otherwise req.userDoc IS the real admin.
    const adminDoc = req.actingAdminDoc || req.userDoc;
    const target = await User.findById(req.params.userId);

    if (!target) {
      return res.status(404).json({ error: "User not found." });
    }
    if (target.role === "admin") {
      return res.status(400).json({ error: "Impersonating another admin isn't supported." });
    }
    if (String(target._id) === String(adminDoc._id)) {
      return res.status(400).json({ error: "You can't impersonate yourself." });
    }

    // Switching targets mid-impersonation — close out the previous log entry.
    if (adminDoc.impersonating?.targetUserId) {
      await ImpersonationLog.updateOne(
        {
          adminId: adminDoc._id,
          targetUserId: adminDoc.impersonating.targetUserId,
          endedAt: null,
        },
        { $set: { endedAt: new Date() } }
      );
    }

    const now = new Date();
    adminDoc.impersonating = { targetUserId: target._id, startedAt: now };
    await adminDoc.save();

    await ImpersonationLog.create({
      adminId: adminDoc._id,
      adminEmail: adminDoc.email,
      targetUserId: target._id,
      targetEmail: target.email,
      targetRole: target.role,
      startedAt: now,
    });

    return res.json({
      success: true,
      impersonating: {
        id: target._id,
        email: target.email,
        displayName: target.displayName,
        role: target.role,
      },
    });
  } catch (err) {
    logger.error({ err }, "[Admin] impersonate start error");
    return res.status(500).json({ error: "Failed to start impersonation." });
  }
}

// ── POST /api/admin/impersonate/stop ────────────────────────────────────────
export async function stopImpersonation(req, res) {
  try {
    const adminDoc = req.actingAdminDoc || req.userDoc;

    if (adminDoc.impersonating?.targetUserId) {
      await ImpersonationLog.updateOne(
        {
          adminId: adminDoc._id,
          targetUserId: adminDoc.impersonating.targetUserId,
          endedAt: null,
        },
        { $set: { endedAt: new Date() } }
      );
    }

    adminDoc.impersonating = { targetUserId: null, startedAt: null };
    await adminDoc.save();

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Admin] impersonate stop error");
    return res.status(500).json({ error: "Failed to stop impersonation." });
  }
}

async function resolvePendingTpoCollege(user) {
  const domain = user?.tpoProfile?.collegeDomain;
  if (!domain) return null;
  return College.findByDomain(domain);
}

export async function approveTpoUser(req, res) {
  try {
    const user = await User.findById(req.params.userId);
    if (!user || user.role !== "tpo") return res.status(404).json({ error: "TPO verification request not found." });
    if (user.tpoProfile?.verified) return res.json({ success: true, alreadyVerified: true });

    const college = await resolvePendingTpoCollege(user);
    if (!college || college.status !== "verified") {
      return res.status(409).json({ error: "The TPO's college must be verified before individual TPO access can be approved." });
    }

    const now = new Date();
    user.tpoProfile.verified = true;
    user.tpoProfile.verifiedAt = now;
    user.tpoVerification = { ...(user.tpoVerification || {}), status: "approved" };
    await user.save();
    invalidateCachedUserByFirebaseUid(user.firebaseUid);

    try {
      await TpoVerificationReview.create({
        userId: user._id,
        collegeId: college._id,
        requestedEmail: user.tpoVerification?.submittedEmail || user.email || "",
        emailRoleSignal: user.tpoVerification?.emailRoleSignal || "unknown",
        evidence: user.tpoVerification?.evidence || [],
        decision: "approved",
        decisionReason: "Approved through individual TPO verification.",
        reviewedBy: req.actingAdminDoc?._id || req.userDoc?._id,
        reviewedAt: now,
      });
    } catch (err) {
      logger.error({ err, userId: user._id }, "[Admin] approveTpoUser: audit write failed");
    }

    try { await claimPrimaryIfNone(college._id, user._id); }
    catch (err) { logger.error({ err, collegeId: college._id, userId: user._id }, "[Admin] approveTpoUser primary claim failed"); }

    recordAdminAction({
      adminDoc: req.actingAdminDoc || req.userDoc,
      action: "tpo.user.approve",
      targetType: "User",
      targetId: user._id,
      details: { collegeId: college._id },
    });

    createNotification({
      userId: user._id,
      type: "tpo_verified",
      title: "TPO access approved",
      message: college.name + " TPO access is now verified.",
      link: "/tpo/dashboard",
    }).catch(() => {});

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Admin] approve TPO user error");
    return res.status(500).json({ error: "Failed to approve TPO verification." });
  }
}

export async function rejectTpoUser(req, res) {
  try {
    const user = await User.findById(req.params.userId);
    if (!user || user.role !== "tpo") return res.status(404).json({ error: "TPO verification request not found." });

    const college = await resolvePendingTpoCollege(user);
    const reviewerId = req.actingAdminDoc?._id || req.userDoc?._id;
    const now = new Date();

    if (reviewerId && college) {
      try {
        await TpoVerificationReview.create({
          userId: user._id,
          collegeId: college._id,
          requestedEmail: user.tpoVerification?.submittedEmail || user.email || "",
          emailRoleSignal: user.tpoVerification?.emailRoleSignal || "unknown",
          evidence: user.tpoVerification?.evidence || [],
          decision: "rejected",
          decisionReason: "Individual TPO verification request rejected.",
          reviewedBy: reviewerId,
          reviewedAt: now,
        });
      } catch (err) {
        logger.error({ err, userId: user._id }, "[Admin] rejectTpoUser: audit write failed");
      }
    }

    user.revokeRole("tpo");
    user.role = "student";
    user.tpoProfile = { collegeDomain: null, collegeName: null, verified: false, requestedAt: null, verifiedAt: null };
    user.tpoVerification = { ...(user.tpoVerification || {}), status: "rejected" };
    await user.save();
    invalidateCachedUserByFirebaseUid(user.firebaseUid);

    recordAdminAction({
      adminDoc: req.actingAdminDoc || req.userDoc,
      action: "tpo.user.reject",
      targetType: "User",
      targetId: user._id,
      details: { collegeId: college?._id || null },
    });

    createNotification({
      userId: user._id,
      type: "tpo_rejected",
      title: "TPO access request declined",
      message: "We couldn't verify your TPO access request. Reach out if this was a mistake.",
      link: "/tpo/signup",
    }).catch(() => {});

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Admin] reject TPO user error");
    return res.status(500).json({ error: "Failed to reject TPO verification." });
  }
}