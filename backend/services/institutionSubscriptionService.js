import mongoose from "mongoose";

/**
 * Institutional subscription service.
 *
 * Subscription state lives on College because entitlement belongs to the
 * institution, not whichever TPO happens to be logged in. This is the
 * canonical read/write boundary for TPO-6 billing state.
 */

export const INSTITUTION_PLAN_IDS = [
  "none",
  "pilot",
  "college_monthly",
  "college_yearly",
  "enterprise",
];

export function isInstitutionSubscriptionActive(college, now = new Date()) {
  const sub = college?.subscription;
  if (!sub) return false;

  if (sub.plan === "none") return false;
  if (!["trialing", "active", "cancelled"].includes(sub.status)) return false;

  // Cancellation does not revoke already-paid access. If an expiry exists,
  // access remains valid until that timestamp.
  if (sub.expiresAt && new Date(sub.expiresAt) <= now) return false;

  return true;
}

export function getInstitutionSubscription(college, now = new Date()) {
  const sub = college?.subscription || {
    plan: "none",
    status: "none",
    startedAt: null,
    expiresAt: null,
    cancelledAt: null,
    provider: "manual",
    providerCustomerId: null,
    providerSubscriptionId: null,
    lastPaymentAt: null,
  };

  return {
    plan: sub.plan || "none",
    status: sub.status || "none",
    startedAt: sub.startedAt || null,
    expiresAt: sub.expiresAt || null,
    cancelledAt: sub.cancelledAt || null,
    provider: sub.provider || "manual",
    providerCustomerId: sub.providerCustomerId || null,
    providerSubscriptionId: sub.providerSubscriptionId || null,
    lastPaymentAt: sub.lastPaymentAt || null,
    isActive: isInstitutionSubscriptionActive({ subscription: sub }, now),
  };
}

export async function setInstitutionSubscription(
  collegeId,
  {
    plan,
    status = "active",
    startedAt = new Date(),
    expiresAt = null,
    cancelledAt = null,
    provider = "manual",
    providerCustomerId = null,
    providerSubscriptionId = null,
    lastPaymentAt = null,
  } = {}
) {
  if (!mongoose.isValidObjectId(collegeId)) {
    const err = new Error("Invalid collegeId.");
    err.code = "INVALID_COLLEGE_ID";
    throw err;
  }

  if (!INSTITUTION_PLAN_IDS.includes(plan)) {
    const err = new Error("Invalid institution plan.");
    err.code = "INVALID_PLAN";
    throw err;
  }

  const College = (await import("../models/College.js")).default;

  const college = await College.findByIdAndUpdate(
    collegeId,
    {
      $set: {
        subscription: {
          plan,
          status,
          startedAt,
          expiresAt,
          cancelledAt,
          provider,
          providerCustomerId,
          providerSubscriptionId,
          lastPaymentAt,
        },
      },
    },
    { new: true, runValidators: true }
  );

  if (!college) {
    const err = new Error("College not found.");
    err.code = "COLLEGE_NOT_FOUND";
    throw err;
  }

  return college;
}

export async function cancelInstitutionSubscription(collegeId, now = new Date()) {
  if (!mongoose.isValidObjectId(collegeId)) {
    const err = new Error("Invalid collegeId.");
    err.code = "INVALID_COLLEGE_ID";
    throw err;
  }

  const College = (await import("../models/College.js")).default;
  const college = await College.findById(collegeId);
  if (!college) {
    const err = new Error("College not found.");
    err.code = "COLLEGE_NOT_FOUND";
    throw err;
  }

  college.subscription.status = "cancelled";
  college.subscription.cancelledAt = now;
  await college.save();
  return college;
}
