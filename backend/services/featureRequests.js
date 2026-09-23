import FeatureRequest from "../models/FeatureRequest.js";
import FeatureRequestVote from "../models/FeatureRequestVote.js";
import { nextSequence } from "../models/Counter.js";
import { issueFeatureRequestShippedReward } from "./rewardPolicyService.js";
import { logger } from "../config/logger.js";

/**
 * services/featureRequests.js — Phase 5 (Feature Requests).
 *
 * See plans/005-feature-requests-scoping.md for the full scoping
 * writeup this file implements against. Same three-part shape
 * services/contribution.js and services/referralQualification.js both
 * already use for "user action -> admin/system decision -> RewardLedger"
 * flows, plus the vote toggle, which is this phase's genuinely new
 * concurrency-sensitive piece (see toggleVote() below).
 *
 * Sole intended callers (batch 2, not yet built — routes/controllers are
 * explicitly out of scope for this pass, same posture Contribution's
 * batch 1 took): a student/recruiter/TPO-facing submission + vote +
 * edit/withdraw endpoint calls createFeatureRequest() / toggleVote() /
 * editFeatureRequest() / withdrawFeatureRequest(); an admin-only status
 * endpoint calls updateFeatureRequestStatus(); an admin-only retry
 * endpoint (mirroring POST /api/admin/referral/retry-rewards) calls
 * retryPendingFeatureRequestRewards().
 */

const TERMINAL_STATUSES = Object.freeze(["shipped", "declined", "withdrawn"]);
const ALL_STATUSES = Object.freeze([
  "open",
  "planned",
  "in_progress",
  "shipped",
  "declined",
  "withdrawn",
]);

function ccPrefix(ccNumber) {
  return `FR/${String(ccNumber).padStart(3, "0")}`;
}

export async function createFeatureRequest({ submittedBy, title, description }) {
  const ccNumber = await nextSequence("featureRequest");
  const ccId = ccPrefix(ccNumber);

  const featureRequest = await FeatureRequest.create({
    ccId,
    ccNumber,
    submittedBy,
    title,
    description,
  });

  await castVote(featureRequest._id, submittedBy);
  featureRequest.voteCount = 1;
  return featureRequest;
}

/**
 * castVote — the shared "add one vote" primitive. Idempotent under a
 * race via FeatureRequestVote's own (featureRequestId, userId) unique
 * index: a losing concurrent call hits E11000 and is treated as a
 * no-op.
 */
async function castVote(featureRequestId, userId) {
  try {
    await FeatureRequestVote.create({ featureRequestId, userId });
  } catch (err) {
    if (err?.code === 11000) {
      return { created: false };
    }
    throw err;
  }

  await FeatureRequest.updateOne({ _id: featureRequestId }, { $inc: { voteCount: 1 } });
  return { created: true };
}

/**
 * toggleVote — concurrency-safe vote/unvote toggle.
 *
 * The operation deliberately attempts the INSERT first rather than doing
 * a find-then-branch. This matters for two simultaneous "vote" requests:
 * both callers initially try to create the same unique vote row, exactly
 * one wins the insert, and the other gets E11000. The losing caller then
 * checks whether it can atomically remove an existing vote; if another
 * caller already owns the vote, it reports voted:true instead of
 * accidentally treating the just-created vote as a user-initiated unvote.
 *
 * For an already-voted user, the duplicate-key path performs the atomic
 * delete. Two simultaneous unvotes therefore cannot both decrement the
 * counter: only the caller that actually deletes the row decrements it.
 */
export async function toggleVote({ featureRequestId, userId }) {
  // Capture the invocation boundary so a vote created by a concurrent
  // request cannot be mistaken for a pre-existing vote and removed.
  const startedAt = new Date();

  const removed = await FeatureRequestVote.findOneAndDelete({
    featureRequestId,
    userId,
    createdAt: { $lt: startedAt },
  });

  if (removed) {
    await FeatureRequest.updateOne(
      { _id: featureRequestId, voteCount: { $gt: 0 } },
      { $inc: { voteCount: -1 } }
    );
    return { voted: false };
  }

  try {
    await FeatureRequestVote.create({ featureRequestId, userId });
  } catch (err) {
    // Another concurrent invocation created the vote after this call
    // started. The user's resulting state is still "voted"; do not
    // remove that other invocation's vote.
    if (err?.code === 11000) return { voted: true };
    throw err;
  }

  await FeatureRequest.updateOne({ _id: featureRequestId }, { $inc: { voteCount: 1 } });
  return { voted: true };
}

export async function editFeatureRequest({ featureRequestId, requesterId, title, description }) {
  const set = {};
  if (title !== undefined) set.title = title;
  if (description !== undefined) set.description = description;

  if (Object.keys(set).length === 0) {
    return { updated: false, reason: "no_fields_provided" };
  }

  const result = await FeatureRequest.updateOne(
    { _id: featureRequestId, submittedBy: requesterId, status: "open" },
    { $set: set }
  );

  if (result.matchedCount === 0) {
    return { updated: false, reason: "not_found_not_owner_or_not_open" };
  }
  return { updated: true };
}

export async function withdrawFeatureRequest({ featureRequestId, requesterId }) {
  const result = await FeatureRequest.updateOne(
    { _id: featureRequestId, submittedBy: requesterId, status: "open" },
    { $set: { status: "withdrawn" } }
  );

  if (result.matchedCount === 0) {
    return { withdrawn: false, reason: "not_found_not_owner_or_not_open" };
  }
  return { withdrawn: true };
}

export async function updateFeatureRequestStatus({ featureRequestId, status, reviewerId }) {
  if (!ALL_STATUSES.includes(status)) {
    throw new Error(`updateFeatureRequestStatus: unknown status "${status}".`);
  }

  const featureRequest = await FeatureRequest.findOneAndUpdate(
    { _id: featureRequestId, status: { $nin: TERMINAL_STATUSES } },
    { $set: { status, reviewedBy: reviewerId, reviewedAt: new Date() } },
    { new: true }
  );

  if (!featureRequest) {
    return { updated: false, reason: "not_found_or_already_terminal" };
  }

  if (status === "shipped") {
    const { rewardStatus } = await attemptRewardIssuance(featureRequest);
    return { updated: true, rewardStatus };
  }

  return { updated: true };
}

async function attemptRewardIssuance(featureRequest) {
  let rewardStatus;
  try {
    const { issued } = await issueFeatureRequestShippedReward({
      submitterId: featureRequest.submittedBy,
      featureRequestId: featureRequest._id,
    });
    rewardStatus = issued ? "issued" : "skipped_unconfigured";
  } catch (err) {
    logger.error(
      { err, featureRequestId: String(featureRequest._id) },
      "[FeatureRequests] reward issuance failed"
    );
    rewardStatus = "failed";
  }

  await FeatureRequest.updateOne({ _id: featureRequest._id }, { $set: { rewardStatus } });
  return { rewardStatus };
}

export async function retryPendingFeatureRequestRewards({ limit = 100 } = {}) {
  const rows = await FeatureRequest.find({
    status: "shipped",
    rewardStatus: { $ne: "issued" },
  }).limit(limit);

  let issued = 0;
  for (const row of rows) {
    const { rewardStatus } = await attemptRewardIssuance(row);
    if (rewardStatus === "issued") issued += 1;
  }

  return { attempted: rows.length, issued, stillUnissued: rows.length - issued };
}

export async function listFeatureRequests({ status, sort = "votes", page = 1, limit = 20 } = {}) {
  const filter = status ? { status } : { status: { $ne: "withdrawn" } };
  const sortSpec = sort === "recent" ? { createdAt: -1 } : { voteCount: -1, createdAt: -1 };
  const skip = (page - 1) * limit;

  const [entries, total] = await Promise.all([
    FeatureRequest.find(filter).sort(sortSpec).skip(skip).limit(limit),
    FeatureRequest.countDocuments(filter),
  ]);

  return { entries, total, page, limit };
}

export async function getMyFeatureRequests({ submittedBy, page = 1, limit = 20 }) {
  const filter = { submittedBy };
  const skip = (page - 1) * limit;

  const [entries, total] = await Promise.all([
    FeatureRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    FeatureRequest.countDocuments(filter),
  ]);

  return { entries, total, page, limit };
}

export async function getVotedRequestIds(userId, featureRequestIds) {
  if (!featureRequestIds?.length) return new Set();
  const votes = await FeatureRequestVote.find({
    userId,
    featureRequestId: { $in: featureRequestIds },
  }).select("featureRequestId");
  return new Set(votes.map((v) => String(v.featureRequestId)));
}
