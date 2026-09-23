import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/FeatureRequest.js", () => ({
  default: {
    create: vi.fn(),
    updateOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));
vi.mock("../models/FeatureRequestVote.js", () => ({
  default: {
    create: vi.fn(),
    findOneAndDelete: vi.fn(),
    find: vi.fn(),
  },
}));
vi.mock("../models/Counter.js", () => ({
  nextSequence: vi.fn(),
}));
vi.mock("./rewardPolicyService.js", () => ({
  issueFeatureRequestShippedReward: vi.fn(),
}));
vi.mock("../config/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import FeatureRequest from "../models/FeatureRequest.js";
import FeatureRequestVote from "../models/FeatureRequestVote.js";
import { nextSequence } from "../models/Counter.js";
import { issueFeatureRequestShippedReward } from "./rewardPolicyService.js";
import { logger } from "../config/logger.js";
import {
  createFeatureRequest,
  toggleVote,
  editFeatureRequest,
  withdrawFeatureRequest,
  updateFeatureRequestStatus,
  retryPendingFeatureRequestRewards,
  listFeatureRequests,
  getMyFeatureRequests,
  getVotedRequestIds,
} from "./featureRequests.js";

const submitterId = "user1";
const reviewerId = "admin1";
const featureRequestId = "fr1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createFeatureRequest", () => {
  it("allocates a ccId/ccNumber via Counter, persists the request, and casts the submitter's own vote", async () => {
    nextSequence.mockResolvedValueOnce(7);
    const doc = { _id: featureRequestId, submittedBy: submitterId, voteCount: 0 };
    FeatureRequest.create.mockResolvedValueOnce(doc);
    FeatureRequestVote.create.mockResolvedValueOnce({});
    FeatureRequest.updateOne.mockResolvedValueOnce({});

    const result = await createFeatureRequest({
      submittedBy: submitterId,
      title: "Dark mode",
      description: "Add a dark theme.",
    });

    expect(nextSequence).toHaveBeenCalledWith("featureRequest");
    expect(FeatureRequest.create).toHaveBeenCalledWith({
      ccId: "FR/007",
      ccNumber: 7,
      submittedBy: submitterId,
      title: "Dark mode",
      description: "Add a dark theme.",
    });
    expect(FeatureRequestVote.create).toHaveBeenCalledWith({
      featureRequestId,
      userId: submitterId,
    });
    expect(FeatureRequest.updateOne).toHaveBeenCalledWith(
      { _id: featureRequestId },
      { $inc: { voteCount: 1 } }
    );
    // The returned document reflects the submitter's own vote immediately,
    // not the stale pre-increment value — same "don't return a stale
    // document" lesson PROGRESS.md flagged for
    // createReferralAssociationQualification()'s own bug.
    expect(result.voteCount).toBe(1);
  });

  it("pads ccNumber to 3 digits", async () => {
    nextSequence.mockResolvedValueOnce(42);
    FeatureRequest.create.mockResolvedValueOnce({ _id: featureRequestId, voteCount: 0 });
    FeatureRequestVote.create.mockResolvedValueOnce({});
    FeatureRequest.updateOne.mockResolvedValueOnce({});

    await createFeatureRequest({ submittedBy: submitterId, title: "T", description: "D" });

    expect(FeatureRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ ccId: "FR/042" })
    );
  });
});

describe("toggleVote", () => {
  it("removes an existing vote and decrements voteCount when the user has already voted", async () => {
    FeatureRequestVote.findOneAndDelete.mockResolvedValueOnce({ _id: "vote1" });
    FeatureRequest.updateOne.mockResolvedValueOnce({});

    const result = await toggleVote({ featureRequestId, userId: submitterId });

    expect(FeatureRequestVote.findOneAndDelete).toHaveBeenCalledWith({
      featureRequestId,
      userId: submitterId,
      createdAt: { $lt: expect.any(Date) },
    });
    expect(FeatureRequest.updateOne).toHaveBeenCalledWith(
      { _id: featureRequestId, voteCount: { $gt: 0 } },
      { $inc: { voteCount: -1 } }
    );
    expect(FeatureRequestVote.create).not.toHaveBeenCalled();
    expect(result).toEqual({ voted: false });
  });

  it("casts a new vote and increments voteCount when the user has not voted yet", async () => {
    FeatureRequestVote.findOneAndDelete.mockResolvedValueOnce(null);
    FeatureRequestVote.create.mockResolvedValueOnce({});
    FeatureRequest.updateOne.mockResolvedValueOnce({});

    const result = await toggleVote({ featureRequestId, userId: submitterId });

    expect(FeatureRequestVote.create).toHaveBeenCalledWith({
      featureRequestId,
      userId: submitterId,
    });
    expect(FeatureRequest.updateOne).toHaveBeenCalledWith(
      { _id: featureRequestId },
      { $inc: { voteCount: 1 } }
    );
    expect(result).toEqual({ voted: true });
  });

  it("treats a losing concurrent vote (E11000 on the unique index) as a no-op success, not a throw", async () => {
    FeatureRequestVote.findOneAndDelete.mockResolvedValueOnce(null);
    const dupErr = Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
    FeatureRequestVote.create.mockRejectedValueOnce(dupErr);

    const result = await toggleVote({ featureRequestId, userId: submitterId });

    expect(FeatureRequest.updateOne).not.toHaveBeenCalled();
    expect(result).toEqual({ voted: true });
  });

  it("re-throws a genuine (non-duplicate-key) error from the vote-row create", async () => {
    FeatureRequestVote.findOneAndDelete.mockResolvedValueOnce(null);
    FeatureRequestVote.create.mockRejectedValueOnce(new Error("DB down"));

    await expect(toggleVote({ featureRequestId, userId: submitterId })).rejects.toThrow(
      "DB down"
    );
  });
});

describe("editFeatureRequest", () => {
  it("returns no_fields_provided and writes nothing when neither title nor description is given", async () => {
    const result = await editFeatureRequest({ featureRequestId, requesterId: submitterId });

    expect(FeatureRequest.updateOne).not.toHaveBeenCalled();
    expect(result).toEqual({ updated: false, reason: "no_fields_provided" });
  });

  it("atomically guards ownership AND status='open' in the same query", async () => {
    FeatureRequest.updateOne.mockResolvedValueOnce({ matchedCount: 1 });

    const result = await editFeatureRequest({
      featureRequestId,
      requesterId: submitterId,
      title: "New title",
    });

    expect(FeatureRequest.updateOne).toHaveBeenCalledWith(
      { _id: featureRequestId, submittedBy: submitterId, status: "open" },
      { $set: { title: "New title" } }
    );
    expect(result).toEqual({ updated: true });
  });

  it("returns not_found_not_owner_or_not_open when the guarded query matches nothing", async () => {
    FeatureRequest.updateOne.mockResolvedValueOnce({ matchedCount: 0 });

    const result = await editFeatureRequest({
      featureRequestId,
      requesterId: submitterId,
      description: "Updated",
    });

    expect(result).toEqual({ updated: false, reason: "not_found_not_owner_or_not_open" });
  });
});

describe("withdrawFeatureRequest", () => {
  it("atomically guards ownership AND status='open', setting status to 'withdrawn'", async () => {
    FeatureRequest.updateOne.mockResolvedValueOnce({ matchedCount: 1 });

    const result = await withdrawFeatureRequest({ featureRequestId, requesterId: submitterId });

    expect(FeatureRequest.updateOne).toHaveBeenCalledWith(
      { _id: featureRequestId, submittedBy: submitterId, status: "open" },
      { $set: { status: "withdrawn" } }
    );
    expect(result).toEqual({ withdrawn: true });
  });

  it("returns not_found_not_owner_or_not_open when the guarded query matches nothing", async () => {
    FeatureRequest.updateOne.mockResolvedValueOnce({ matchedCount: 0 });

    const result = await withdrawFeatureRequest({ featureRequestId, requesterId: submitterId });

    expect(result).toEqual({ withdrawn: false, reason: "not_found_not_owner_or_not_open" });
  });
});

describe("updateFeatureRequestStatus", () => {
  it("throws on an unknown status value without touching the DB", async () => {
    await expect(
      updateFeatureRequestStatus({ featureRequestId, status: "archived", reviewerId })
    ).rejects.toThrow(/unknown status/);
    expect(FeatureRequest.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("returns not_found_or_already_terminal when no non-terminal row matches", async () => {
    FeatureRequest.findOneAndUpdate.mockResolvedValueOnce(null);

    const result = await updateFeatureRequestStatus({
      featureRequestId,
      status: "planned",
      reviewerId,
    });

    expect(FeatureRequest.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: featureRequestId, status: { $nin: ["shipped", "declined", "withdrawn"] } },
      { $set: expect.objectContaining({ status: "planned", reviewedBy: reviewerId }) },
      { new: true }
    );
    expect(result).toEqual({ updated: false, reason: "not_found_or_already_terminal" });
  });

  it("transitions to a non-shipped status without attempting a reward", async () => {
    FeatureRequest.findOneAndUpdate.mockResolvedValueOnce({ _id: featureRequestId });

    const result = await updateFeatureRequestStatus({
      featureRequestId,
      status: "in_progress",
      reviewerId,
    });

    expect(issueFeatureRequestShippedReward).not.toHaveBeenCalled();
    expect(result).toEqual({ updated: true });
  });

  it("declining does not attempt a reward", async () => {
    FeatureRequest.findOneAndUpdate.mockResolvedValueOnce({ _id: featureRequestId });

    await updateFeatureRequestStatus({ featureRequestId, status: "declined", reviewerId });

    expect(issueFeatureRequestShippedReward).not.toHaveBeenCalled();
  });

  it("attempts reward issuance on reaching 'shipped' and marks rewardStatus issued on success", async () => {
    FeatureRequest.findOneAndUpdate.mockResolvedValueOnce({
      _id: featureRequestId,
      submittedBy: submitterId,
    });
    issueFeatureRequestShippedReward.mockResolvedValueOnce({ issued: true });

    const result = await updateFeatureRequestStatus({
      featureRequestId,
      status: "shipped",
      reviewerId,
    });

    expect(issueFeatureRequestShippedReward).toHaveBeenCalledWith({
      submitterId,
      featureRequestId,
    });
    expect(FeatureRequest.updateOne).toHaveBeenCalledWith(
      { _id: featureRequestId },
      { $set: { rewardStatus: "issued" } }
    );
    expect(result).toEqual({ updated: true, rewardStatus: "issued" });
  });

  it("marks rewardStatus skipped_unconfigured when the policy layer reports issued: false", async () => {
    FeatureRequest.findOneAndUpdate.mockResolvedValueOnce({
      _id: featureRequestId,
      submittedBy: submitterId,
    });
    issueFeatureRequestShippedReward.mockResolvedValueOnce({
      issued: false,
      reason: "not_configured",
    });

    const result = await updateFeatureRequestStatus({
      featureRequestId,
      status: "shipped",
      reviewerId,
    });

    expect(result).toEqual({ updated: true, rewardStatus: "skipped_unconfigured" });
  });

  it("marks rewardStatus failed, logs, and does not throw when reward issuance errors", async () => {
    FeatureRequest.findOneAndUpdate.mockResolvedValueOnce({
      _id: featureRequestId,
      submittedBy: submitterId,
    });
    issueFeatureRequestShippedReward.mockRejectedValueOnce(new Error("ledger down"));

    const result = await updateFeatureRequestStatus({
      featureRequestId,
      status: "shipped",
      reviewerId,
    });

    expect(logger.error).toHaveBeenCalled();
    expect(result).toEqual({ updated: true, rewardStatus: "failed" });
  });
});

describe("retryPendingFeatureRequestRewards", () => {
  it("queries shipped rows whose rewardStatus is not issued, capped at the given limit", async () => {
    const limitFn = vi.fn().mockResolvedValue([]);
    FeatureRequest.find.mockReturnValueOnce({ limit: limitFn });

    await retryPendingFeatureRequestRewards({ limit: 50 });

    expect(FeatureRequest.find).toHaveBeenCalledWith({
      status: "shipped",
      rewardStatus: { $ne: "issued" },
    });
    expect(limitFn).toHaveBeenCalledWith(50);
  });

  it("defaults limit to 100 when omitted", async () => {
    const limitFn = vi.fn().mockResolvedValue([]);
    FeatureRequest.find.mockReturnValueOnce({ limit: limitFn });

    await retryPendingFeatureRequestRewards();

    expect(limitFn).toHaveBeenCalledWith(100);
  });

  it("re-attempts each row, tallying issued vs. still-unissued correctly", async () => {
    const rows = [
      { _id: "fr1", submittedBy: submitterId },
      { _id: "fr2", submittedBy: submitterId },
      { _id: "fr3", submittedBy: submitterId },
    ];
    const limitFn = vi.fn().mockResolvedValue(rows);
    FeatureRequest.find.mockReturnValueOnce({ limit: limitFn });
    FeatureRequest.updateOne.mockResolvedValue({});

    issueFeatureRequestShippedReward
      .mockResolvedValueOnce({ issued: true })
      .mockResolvedValueOnce({ issued: false, reason: "not_configured" })
      .mockRejectedValueOnce(new Error("ledger down"));

    const result = await retryPendingFeatureRequestRewards();

    expect(result).toEqual({ attempted: 3, issued: 1, stillUnissued: 2 });
  });

  it("returns a zero tally for an empty queue", async () => {
    const limitFn = vi.fn().mockResolvedValue([]);
    FeatureRequest.find.mockReturnValueOnce({ limit: limitFn });

    const result = await retryPendingFeatureRequestRewards();

    expect(result).toEqual({ attempted: 0, issued: 0, stillUnissued: 0 });
  });
});

describe("listFeatureRequests", () => {
  function mockFindChain(entries) {
    const limitFn = vi.fn().mockResolvedValue(entries);
    const skipFn = vi.fn().mockReturnValue({ limit: limitFn });
    const sortFn = vi.fn().mockReturnValue({ skip: skipFn });
    FeatureRequest.find.mockReturnValueOnce({ sort: sortFn });
    return { sortFn, skipFn, limitFn };
  }

  it("excludes withdrawn requests and sorts by voteCount by default", async () => {
    const { sortFn, skipFn, limitFn } = mockFindChain([{ _id: "fr1" }]);
    FeatureRequest.countDocuments.mockResolvedValueOnce(1);

    const result = await listFeatureRequests();

    expect(FeatureRequest.find).toHaveBeenCalledWith({ status: { $ne: "withdrawn" } });
    expect(sortFn).toHaveBeenCalledWith({ voteCount: -1, createdAt: -1 });
    expect(skipFn).toHaveBeenCalledWith(0);
    expect(limitFn).toHaveBeenCalledWith(20);
    expect(result).toEqual({ entries: [{ _id: "fr1" }], total: 1, page: 1, limit: 20 });
  });

  it("filters by an explicit status when given", async () => {
    mockFindChain([]);
    FeatureRequest.countDocuments.mockResolvedValueOnce(0);

    await listFeatureRequests({ status: "planned" });

    expect(FeatureRequest.find).toHaveBeenCalledWith({ status: "planned" });
    expect(FeatureRequest.countDocuments).toHaveBeenCalledWith({ status: "planned" });
  });

  it("sorts by recency when sort='recent'", async () => {
    const { sortFn } = mockFindChain([]);
    FeatureRequest.countDocuments.mockResolvedValueOnce(0);

    await listFeatureRequests({ sort: "recent" });

    expect(sortFn).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it("computes skip from page and limit", async () => {
    const { skipFn } = mockFindChain([]);
    FeatureRequest.countDocuments.mockResolvedValueOnce(0);

    await listFeatureRequests({ page: 3, limit: 10 });

    expect(skipFn).toHaveBeenCalledWith(20);
  });
});

describe("getMyFeatureRequests", () => {
  it("includes every status (withdrawn included) for the requester's own history", async () => {
    const limitFn = vi.fn().mockResolvedValue([{ _id: "fr1", status: "withdrawn" }]);
    const skipFn = vi.fn().mockReturnValue({ limit: limitFn });
    const sortFn = vi.fn().mockReturnValue({ skip: skipFn });
    FeatureRequest.find.mockReturnValueOnce({ sort: sortFn });
    FeatureRequest.countDocuments.mockResolvedValueOnce(1);

    const result = await getMyFeatureRequests({ submittedBy: submitterId });

    expect(FeatureRequest.find).toHaveBeenCalledWith({ submittedBy: submitterId });
    expect(result.entries).toEqual([{ _id: "fr1", status: "withdrawn" }]);
  });
});

describe("getVotedRequestIds", () => {
  it("returns an empty Set without querying when given no ids", async () => {
    const result = await getVotedRequestIds(submitterId, []);

    expect(FeatureRequestVote.find).not.toHaveBeenCalled();
    expect(result).toEqual(new Set());
  });

  it("returns a Set of the feature request ids this user has voted on", async () => {
    const selectFn = vi.fn().mockResolvedValue([
      { featureRequestId: "fr1" },
      { featureRequestId: "fr2" },
    ]);
    FeatureRequestVote.find.mockReturnValueOnce({ select: selectFn });

    const result = await getVotedRequestIds(submitterId, ["fr1", "fr2", "fr3"]);

    expect(FeatureRequestVote.find).toHaveBeenCalledWith({
      userId: submitterId,
      featureRequestId: { $in: ["fr1", "fr2", "fr3"] },
    });
    expect(result).toEqual(new Set(["fr1", "fr2"]));
  });
});