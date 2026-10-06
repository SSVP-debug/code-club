import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/Contest.js", () => ({
  default: { find: vi.fn() },
}));
vi.mock("../models/ContestParticipant.js", () => ({
  default: { exists: vi.fn() },
}));

import Contest from "../models/Contest.js";
import ContestParticipant from "../models/ContestParticipant.js";
import { canAccessContestProblem } from "./contestProblemAccess.js";

function mockContestQuery(contests) {
  Contest.find.mockReturnValue({
    select() { return this; },
    lean: vi.fn().mockResolvedValue(contests),
  });
}

function makeContest(overrides = {}) {
  const now = Date.now();
  return {
    _id: "contest1",
    startsAt: new Date(now - 60_000),
    endsAt: new Date(now + 60_000),
    createdBy: "organizer1",
    ...overrides,
  };
}

describe("canAccessContestProblem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ContestParticipant.exists.mockResolvedValue(false);
  });

  it("fails closed when no contest references the slug", async () => {
    mockContestQuery([]);

    await expect(
      canAccessContestProblem("secret-slug", { _id: "user1" })
    ).resolves.toBe(false);
    expect(ContestParticipant.exists).not.toHaveBeenCalled();
  });

  it("denies an anonymous caller during an active contest", async () => {
    mockContestQuery([makeContest()]);

    await expect(canAccessContestProblem("secret-slug", null)).resolves.toBe(false);
    expect(ContestParticipant.exists).not.toHaveBeenCalled();
  });

  it("denies an authenticated non-participant during an active contest", async () => {
    mockContestQuery([makeContest()]);

    await expect(
      canAccessContestProblem("secret-slug", { _id: "random-user" })
    ).resolves.toBe(false);

    expect(ContestParticipant.exists).toHaveBeenCalledWith({
      contestId: { $in: ["contest1"] },
      userId: "random-user",
    });
  });

  it("allows a joined participant during an active contest", async () => {
    mockContestQuery([makeContest()]);
    ContestParticipant.exists.mockResolvedValue(true);

    await expect(
      canAccessContestProblem("secret-slug", { _id: "participant1" })
    ).resolves.toBe(true);
  });

  it("denies a participant while the contest is upcoming", async () => {
    const now = Date.now();
    mockContestQuery([
      makeContest({
        startsAt: new Date(now + 60_000),
        endsAt: new Date(now + 120_000),
      }),
    ]);

    await expect(
      canAccessContestProblem("secret-slug", { _id: "participant1" })
    ).resolves.toBe(false);
    expect(ContestParticipant.exists).not.toHaveBeenCalled();
  });

  it("allows the organizer before the contest starts", async () => {
    const now = Date.now();
    mockContestQuery([
      makeContest({
        startsAt: new Date(now + 60_000),
        endsAt: new Date(now + 120_000),
      }),
    ]);

    await expect(
      canAccessContestProblem("secret-slug", { _id: "organizer1" })
    ).resolves.toBe(true);
    expect(ContestParticipant.exists).not.toHaveBeenCalled();
  });

  it("opens the problem to everyone after the contest ends", async () => {
    const now = Date.now();
    mockContestQuery([
      makeContest({
        startsAt: new Date(now - 120_000),
        endsAt: new Date(now - 60_000),
      }),
    ]);

    await expect(
      canAccessContestProblem("secret-slug", { _id: "random-user" })
    ).resolves.toBe(true);
    await expect(canAccessContestProblem("secret-slug", null)).resolves.toBe(true);
    expect(ContestParticipant.exists).not.toHaveBeenCalled();
  });

  it("allows access when any active contest grants participation access", async () => {
    const now = Date.now();
    mockContestQuery([
      makeContest({
        _id: "contest-upcoming",
        startsAt: new Date(now + 60_000),
        endsAt: new Date(now + 120_000),
        createdBy: "other-organizer",
      }),
      makeContest({ _id: "contest-active" }),
    ]);
    ContestParticipant.exists.mockResolvedValue(true);

    await expect(
      canAccessContestProblem("secret-slug", { _id: "participant1" })
    ).resolves.toBe(true);

    expect(ContestParticipant.exists).toHaveBeenCalledWith({
      contestId: { $in: ["contest-active"] },
      userId: "participant1",
    });
  });
});
