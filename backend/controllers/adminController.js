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
        {
          role: "tpo",
          "tpoProfile.verified": false,
          "tpoVerification.status": "pending",
        },
        "email displayName tpoProfile tpoVerification createdAt"
      )
        .sort({ "tpoProfile.requestedAt": 1, createdAt: 1 })
        .lean(),
      User.find(
        {
          role: "tpo",
          "tpoProfile.verified": false,
          "tpoVerification.status": "pending",
        },
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
        ...individualTpoRequests.map((u) => {
          const signal = u.tpoVerification?.emailRoleSignal || "unknown";
          return {
            userId: u._id,
            collegeId: null,
            collegeName: u.tpoProfile?.collegeName || "Unknown college",
            domain: u.tpoProfile?.collegeDomain,
            domains: u.tpoProfile?.collegeDomain ? [u.tpoProfile.collegeDomain] : [],
            requestedBy: { email: u.email, displayName: u.displayName },
            requestedAt: u.tpoVerification?.submittedAt || u.tpoProfile?.requestedAt || u.createdAt,
            emailRoleSignal: signal,
            verificationStatus: u.tpoVerification?.status || "pending",
            additionalEvidenceRecommended: signal !== "staff_candidate",
            evidence: u.tpoVerification?.evidence || [],
            reviewTarget: "user",
          };
        }),
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