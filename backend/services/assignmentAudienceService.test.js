import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/User.js", () => ({ default: { find: vi.fn() } }));
vi.mock("../models/College.js", () => ({ default: { findById: vi.fn() } }));
vi.mock("../models/CohortMembership.js", () => ({ default: { find: vi.fn() } }));

import User from "../models/User.js";
import College from "../models/College.js";
import CohortMembership from "../models/CohortMembership.js";
import { getAssignmentAudience } from "./assignmentAudienceService.js";

const userChain = (students) => ({ select: () => ({ lean: () => Promise.resolve(students) }) });

describe("getAssignmentAudience", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cohort-scoped assignment: resolves audience from active cohort membership only", async () => {
    CohortMembership.find.mockReturnValue({ distinct: () => Promise.resolve(["s1", "s2"]) });
    User.find.mockReturnValue(userChain([{ _id: "s1" }, { _id: "s2" }]));

    const result = await getAssignmentAudience({ cohortId: "cohort-1" });

    expect(CohortMembership.find).toHaveBeenCalledWith(
      expect.objectContaining({ cohortId: "cohort-1", status: "active" })
    );
    expect(User.find).toHaveBeenCalledWith({ _id: { $in: ["s1", "s2"] }, role: "student" });
    expect(result).toEqual([{ _id: "s1" }, { _id: "s2" }]);
    expect(College.findById).not.toHaveBeenCalled();
  });

  it("legacy college-wide assignment with collegeId: uses every domain the College spans", async () => {
    College.findById.mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ domains: ["A.edu", "b.edu"] }) }) });
    User.find.mockReturnValue(userChain([{ _id: "s1" }]));

    await getAssignmentAudience({ collegeId: "college-1", collegeDomain: "a.edu" });

    expect(User.find).toHaveBeenCalledWith({ emailDomain: { $in: ["a.edu", "b.edu"] }, role: "student" });
  });

  it("legacy assignment with collegeId but the College has no domains recorded: falls back to collegeDomain", async () => {
    College.findById.mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ domains: [] }) }) });
    User.find.mockReturnValue(userChain([]));

    await getAssignmentAudience({ collegeId: "college-1", collegeDomain: "Fallback.edu" });

    expect(User.find).toHaveBeenCalledWith({ emailDomain: { $in: ["fallback.edu"] }, role: "student" });
  });

  it("pre-migration assignment with no collegeId at all: uses collegeDomain directly", async () => {
    User.find.mockReturnValue(userChain([{ _id: "s1" }]));

    await getAssignmentAudience({ collegeDomain: "Legacy.edu" });

    expect(College.findById).not.toHaveBeenCalled();
    expect(User.find).toHaveBeenCalledWith({ emailDomain: { $in: ["legacy.edu"] }, role: "student" });
  });

  it("returns [] without querying Users when there's no cohort, no collegeId, and no collegeDomain", async () => {
    const result = await getAssignmentAudience({});

    expect(result).toEqual([]);
    expect(User.find).not.toHaveBeenCalled();
  });

  it("passes selectFields through to the User query's .select()", async () => {
    const selectSpy = vi.fn().mockReturnValue({ lean: () => Promise.resolve([]) });
    User.find.mockReturnValue({ select: selectSpy });

    await getAssignmentAudience({ collegeDomain: "a.edu" }, "_id displayName email solvedSlugs");

    expect(selectSpy).toHaveBeenCalledWith("_id displayName email solvedSlugs");
  });
});
