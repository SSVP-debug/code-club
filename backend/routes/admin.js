import { Router } from "express";
import { setInstitutionSubscription, cancelInstitutionSubscription } from "../services/institutionSubscriptionService.js";
import { requireAdmin } from "../middleware/roleGuard.js";
import {
  getPendingQueue,
  approveRecruiter,
  rejectRecruiter,
  approveTpo,
  rejectTpo,
  approveStudentCollege,
  rejectStudentCollege,
  listUsers,
  getAuditLogs,
  getDashboardMetrics,
  suspendUser,
  activateUser,
  deleteUser,
  resetUserProgress,
  changeUserRole,
  startImpersonation,
  stopImpersonation,
} from "../controllers/adminController.js";
import { getColleges, renameCollege, updateEmailRolePatterns } from "../controllers/collegeController.js";
import {
  listProblemsForAdmin,
  getProblemForAdmin,
  createProblem,
  updateProblem,
  deleteProblem,
} from "../controllers/adminProblemController.js";
import {
  getRegistrationTrends,
  getSubmissionTrends,
  getActiveUserTrends,
  getRetentionMetric,
  getProblemPopularity,
  getLanguagePopularity,
} from "../controllers/adminAnalyticsController.js";
import { getSystemHealth } from "../controllers/adminHealthController.js";
import { getSettingsAdmin, updateSettingsAdmin } from "../controllers/adminSettingsController.js";
import { validateBody } from "../middleware/validateBody.js";
import { aiLimiter } from "../middleware/rateLimiter.js";
import {
  OpportunityCreateSchema,
  OpportunityUpdateSchema,
  OpportunityRejectSchema,
} from "../schemas/opportunitySchema.js";
import {
  listOpportunitiesAdmin,
  getOpportunityAdmin,
  createOpportunity,
  updateOpportunity,
  submitForReview,
  approveOpportunity,
  publishOpportunity,
  rejectOpportunity,
  archiveOpportunity,
  markExpiredOpportunity,
  duplicateOpportunity,
  getOpportunityAnalytics,
} from "../controllers/adminOpportunityController.js";
import {
  extractOpportunities,
  importSelectedOpportunities,
} from "../controllers/adminOpportunityImportController.js";
import { getUserLedgerAdmin } from "../controllers/rewardController.js";
import { retryReferralRewards } from "../controllers/adminReferralController.js";
import {
  ContributionRejectSchema,
  ContributionRetrySchema,
} from "../schemas/contributionSchema.js";
import {
  listContributionsAdmin,
  approveContributionAdmin,
  rejectContributionAdmin,
  retryContributionRewardsAdmin,
} from "../controllers/adminContributionController.js";
import {
  CatalogItemCreateSchema,
  CatalogItemUpdateSchema,
  RedemptionRejectSchema,
  RedemptionFulfillSchema,
} from "../schemas/rewardStoreSchema.js";
import {
  listCatalogItemsAdmin,
  createCatalogItemAdmin,
  updateCatalogItemAdmin,
  listRedemptionsAdmin,
  fulfillRedemptionAdmin,
  rejectRedemptionAdmin,
} from "../controllers/adminRewardStoreController.js";
import {
  FeatureRequestStatusUpdateSchema,
  FeatureRequestRetrySchema,
} from "../schemas/featureRequestSchema.js";
import {
  listFeatureRequestsAdmin,
  updateFeatureRequestStatusAdmin,
  retryFeatureRequestRewardsAdmin,
} from "../controllers/adminFeatureRequestController.js";

const router = Router();

// ── Verification queue (Phase B, extended for student college requests) ────
router.get("/pending", requireAdmin, getPendingQueue);
router.post("/recruiters/:id/approve", requireAdmin, approveRecruiter);
router.post("/recruiters/:id/reject", requireAdmin, rejectRecruiter);
router.post("/tpo/:collegeId/approve", requireAdmin, approveTpo);
router.post("/tpo/:collegeId/reject", requireAdmin, rejectTpo);
router.post("/student-colleges/:collegeId/approve", requireAdmin, approveStudentCollege);
router.post("/student-colleges/:collegeId/reject", requireAdmin, rejectStudentCollege);

// ── Impersonation — "Login As" ──────────────────────────────────────────────
router.get("/users", requireAdmin, listUsers);

// ── Colleges ─────────────────────────────────────────────────────────────────
router.get("/colleges", requireAdmin, getColleges);
router.patch("/colleges/:collegeId", requireAdmin, renameCollege);
router.patch("/colleges/:collegeId/email-role-patterns", requireAdmin, updateEmailRolePatterns);
// NOTE: order matters here. "/impersonate/stop" must be registered before
// the parameterized "/impersonate/:userId" — Express matches routes in
// registration order, and :userId matches the literal segment "stop" too.
// With the old order, POST /impersonate/stop was being swallowed by the
// :userId route (startImpersonation ran with userId="stop", which always
// 404/500'd on User.findById("stop") — stopImpersonation was never called,
// so "Exit Impersonation" never actually cleared the admin's impersonating
// state; it just reloaded back into the still-impersonated session).
router.post("/impersonate/stop", requireAdmin, stopImpersonation);
router.post("/impersonate/:userId", requireAdmin, startImpersonation);

// ── Institution billing (TPO-6) ───────────────────────────────────────────
// Admin-only manual entitlement controls form the provider-independent
// foundation. Payment-provider automation can call the same service later.
router.post("/colleges/:collegeId/subscription", requireAdmin, async (req, res) => {
  try {
    const { plan, status, expiresAt, provider = "manual" } = req.body || {};
    const college = await setInstitutionSubscription(req.params.collegeId, {
      plan,
      status: status || "active",
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      provider,
    });
    return res.json({
      success: true,
      collegeId: college._id,
      subscription: college.subscription,
    });
  } catch (err) {
    const statusCode =
      err.code === "INVALID_COLLEGE_ID" || err.code === "INVALID_PLAN" ? 400 :
      err.code === "COLLEGE_NOT_FOUND" ? 404 : 500;
    return res.status(statusCode).json({ error: err.message || "Failed to update institution subscription." });
  }
});

router.post("/colleges/:collegeId/subscription/cancel", requireAdmin, async (req, res) => {
  try {
    const college = await cancelInstitutionSubscription(req.params.collegeId);
    return res.json({
      success: true,
      collegeId: college._id,
      subscription: college.subscription,
    });
  } catch (err) {
    const statusCode =
      err.code === "INVALID_COLLEGE_ID" ? 400 :
      err.code === "COLLEGE_NOT_FOUND" ? 404 : 500;
    return res.status(statusCode).json({ error: err.message || "Failed to cancel institution subscription." });
  }
});

// ── User management actions ─────────────────────────────────────────────────
router.post("/users/:id/suspend", requireAdmin, suspendUser);
router.post("/users/:id/activate", requireAdmin, activateUser);
router.delete("/users/:id", requireAdmin, deleteUser);
router.post("/users/:id/reset-progress", requireAdmin, resetUserProgress);
router.post("/users/:id/role", requireAdmin, changeUserRole);

// ── Audit log ────────────────────────────────────────────────────────────────
router.get("/audit-logs", requireAdmin, getAuditLogs);

// ── Dashboard metrics ────────────────────────────────────────────────────────
router.get("/dashboard-metrics", requireAdmin, getDashboardMetrics);

// ── Problems ─────────────────────────────────────────────────────────────────
router.get("/problems", requireAdmin, listProblemsForAdmin);
router.get("/problems/:slug", requireAdmin, getProblemForAdmin);
router.post("/problems", requireAdmin, createProblem);
router.patch("/problems/:slug", requireAdmin, updateProblem);
router.delete("/problems/:slug", requireAdmin, deleteProblem);

// ── Analytics ────────────────────────────────────────────────────────────────
router.get("/analytics/registrations", requireAdmin, getRegistrationTrends);
router.get("/analytics/submissions", requireAdmin, getSubmissionTrends);
router.get("/analytics/active-users", requireAdmin, getActiveUserTrends);
router.get("/analytics/retention", requireAdmin, getRetentionMetric);
router.get("/analytics/problems", requireAdmin, getProblemPopularity);
router.get("/analytics/languages", requireAdmin, getLanguagePopularity);

// ── Opportunity Radar ────────────────────────────────────────────────────────
// Admin management always works regardless of OPPORTUNITY_RADAR_ENABLED —
// see that flag's comment in config/featureFlags.js for why.
// Import — static paths, placed before the /:id routes below to avoid any
// ambiguity with the dynamic :id segment (defensive ordering; Express
// wouldn't currently collide since no route below matches a bare
// "/opportunities/import" path, but ordering static before dynamic is the
// safer convention to keep as more opportunity sub-routes get added).
router.post("/opportunities/import/extract", requireAdmin, aiLimiter, extractOpportunities);
router.post("/opportunities/import/bulk", requireAdmin, importSelectedOpportunities);

router.get("/opportunities", requireAdmin, listOpportunitiesAdmin);
router.get("/opportunities/:id", requireAdmin, getOpportunityAdmin);
router.post("/opportunities", requireAdmin, validateBody(OpportunityCreateSchema), createOpportunity);
router.patch("/opportunities/:id", requireAdmin, validateBody(OpportunityUpdateSchema), updateOpportunity);
router.post("/opportunities/:id/submit-review", requireAdmin, submitForReview);
router.post("/opportunities/:id/approve", requireAdmin, approveOpportunity);
router.post("/opportunities/:id/publish", requireAdmin, publishOpportunity);
router.post("/opportunities/:id/reject", requireAdmin, validateBody(OpportunityRejectSchema), rejectOpportunity);
router.post("/opportunities/:id/archive", requireAdmin, archiveOpportunity);
router.post("/opportunities/:id/mark-expired", requireAdmin, markExpiredOpportunity);
router.post("/opportunities/:id/duplicate", requireAdmin, duplicateOpportunity);
router.get("/opportunities/:id/analytics", requireAdmin, getOpportunityAnalytics);

// ── Reward Ledger (Phase 2 — Contribution Infrastructure + Referral System) ──
// Read-only: any mutation to the ledger happens exclusively through
// services/rewardLedger.js's issueReward(), called from the referral-
// qualification and (future) contribution-approval flows — never from an
// admin-facing write endpoint. This exists for support/dispute lookups
// ("why does this user have N tokens") on an account other than the
// caller's own — see routes/rewards.js for the equivalent self-service
// endpoints every user has for their own balance/ledger.
router.get("/rewards/ledger", requireAdmin, getUserLedgerAdmin);

// ── Referral Qualification reward retry (Plan 2 refinement) ────────────────
// Idempotent reconciliation, not a direct ledger write — see
// controllers/adminReferralController.js and services/
// referralQualification.js's retryPendingReferralRewards() for why this
// can never itself cause a double-issue (RewardLedger's own idempotency
// index is what prevents that, unmodified by this route).
router.post("/referral/retry-rewards", requireAdmin, retryReferralRewards);

// ── Contribution Infrastructure (Phase 2F) — review queue + reward retry ───
// Same shape as the Referral Qualification retry route immediately above:
// approve/reject are atomic state transitions (services/contribution.js),
// and retry-rewards is an idempotent reconciliation pass, not a direct
// ledger write — RewardLedger's own idempotency index is what actually
// prevents a double-issue, unmodified by any of these routes.
router.get("/contributions", requireAdmin, listContributionsAdmin);
router.post("/contributions/:id/approve", requireAdmin, approveContributionAdmin);
router.post(
  "/contributions/:id/reject",
  requireAdmin,
  validateBody(ContributionRejectSchema),
  rejectContributionAdmin
);
router.post(
  "/contributions/retry-rewards",
  requireAdmin,
  validateBody(ContributionRetrySchema),
  retryContributionRewardsAdmin
);

// ── Rewards Store (Phase 4) — catalog management + fulfillment queue ───────
// Catalog CRUD goes straight to the RewardCatalogItem model
// (adminRewardStoreController.js) — no service-layer indirection needed
// for a plain create/edit, unlike the redemption lifecycle below, which
// routes through services/rewardStore.js for its atomic balance-guard
// and reversal mechanics. fulfill/reject never touch RewardLedger
// directly from this router — same "controller stays thin, the real
// logic lives in the service" shape as the Contribution routes above.
router.get("/reward-store/items", requireAdmin, listCatalogItemsAdmin);
router.post(
  "/reward-store/items",
  requireAdmin,
  validateBody(CatalogItemCreateSchema),
  createCatalogItemAdmin
);
router.patch(
  "/reward-store/items/:id",
  requireAdmin,
  validateBody(CatalogItemUpdateSchema),
  updateCatalogItemAdmin
);
router.get("/reward-store/redemptions", requireAdmin, listRedemptionsAdmin);
router.post(
  "/reward-store/redemptions/:id/fulfill",
  requireAdmin,
  validateBody(RedemptionFulfillSchema),
  fulfillRedemptionAdmin
);
router.post(
  "/reward-store/redemptions/:id/reject",
  requireAdmin,
  validateBody(RedemptionRejectSchema),
  rejectRedemptionAdmin
);

// ── Feature Requests (Phase 5) — status management + reward retry ──────────
// Same shape as the Contribution routes above: status transitions are
// atomic (services/featureRequests.js's updateFeatureRequestStatus(),
// guarded so a terminal request can never be re-transitioned), and
// retry-rewards is an idempotent reconciliation pass — RewardLedger's
// own idempotency index is what actually prevents a double-issue,
// unmodified by any of these routes. "open" and "withdrawn" are
// deliberately not reachable through this endpoint — see
// schemas/featureRequestSchema.js's own comment on why.
router.get("/feature-requests", requireAdmin, listFeatureRequestsAdmin);
router.post(
  "/feature-requests/:id/status",
  requireAdmin,
  validateBody(FeatureRequestStatusUpdateSchema),
  updateFeatureRequestStatusAdmin
);
router.post(
  "/feature-requests/retry-rewards",
  requireAdmin,
  validateBody(FeatureRequestRetrySchema),
  retryFeatureRequestRewardsAdmin
);

// ── System health ────────────────────────────────────────────────────────────
router.get("/system-health", requireAdmin, getSystemHealth);

// ── Settings ─────────────────────────────────────────────────────────────────
router.get("/settings", requireAdmin, getSettingsAdmin);
router.patch("/settings", requireAdmin, updateSettingsAdmin);

export default router;