import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/BattleRoom.js", () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
    create: vi.fn(),
    deleteOne: vi.fn(),
  },
}));
vi.mock("../models/Problem.js", () => ({
  default: { countDocuments: vi.fn() },
}));
vi.mock("../models/Submission.js", () => ({
  default: { exists: vi.fn() },
}));
vi.mock("../services/battleRoomScoring.js", () => ({
  awardBattleRoomSolve: vi.fn(),
}));

import BattleRoom from "../models/BattleRoom.js";
import Problem from "../models/Problem.js";
import Submission from "../models/Submission.js";
import { awardBattleRoomSolve } from "../services/battleRoomScoring.js";
import battleRoomsRouter from "./battleRooms.js";

// battleRooms.js doesn't export its handlers individually — pull them off
// the real router's stack, same convention as routes/contests.test.js. This
// exercises the actual handler code and deliberately skips over any
// auth/role middleware registered on the route. The router-level wiring
// tests below verify that the create route is actually protected.
function getHandler(method, path) {
  const layer = battleRoomsRouter.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method]
  );
  if (!layer) throw new Error(`No ${method.toUpperCase()} route registered for path ${path}`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

// router.param("id", ...) validators live in router.params, not
// router.stack, in Express — this pulls the actual registered validator so
// the "malformed id → 400, not an unhandled CastError → 500" behavior is
// tested against real code, not a re-implementation of the regex.
function getIdParamValidator() {
  return battleRoomsRouter.params.id[0];
}

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockLog() {
  return { error: vi.fn(), warn: vi.fn() };
}

function userDoc(overrides = {}) {
  return {
    _id: "user1",
    username: "alice",
    displayName: "Alice",
    role: "student",
    ...overrides,
  };
}

function makeRoomDoc(overrides = {}) {
  const now = Date.now();
  const doc = {
    _id: "room1",
    title: "Friday Night Battle",
    createdBy: "host1",
    inviteCode: "ABC123",
    status: "lobby",
    problemSlugs: ["two-sum"],
    maxTeamSize: 4,
    durationMs: 60 * 60 * 1000,
    startsAt: null,
    endsAt: null,
    roster: [],
    teams: [{ name: "Team Alpha", score: 0, solvedSlugs: [] }, { name: "Team Beta", score: 0, solvedSlugs: [] }],
    ...overrides,
  };
  doc.save = vi.fn().mockResolvedValue(doc);
  doc.toObject = vi.fn().mockReturnValue({ ...doc });
  return doc;
}

function queryResult(value) {
  return { lean: () => Promise.resolve(value), then: (resolve) => resolve(value) };
}

describe("router.param('id') — malformed id handling", () => {
  it("returns 400, not an unhandled CastError, for a malformed id", () => {
    const res = mockRes();
    const next = vi.fn();
    const validator = getIdParamValidator();

    validator({}, res, next, "not-a-real-id");

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() for a well-formed 24-hex-char id", () => {
    const res = mockRes();
    const next = vi.fn();
    const validator = getIdParamValidator();

    validator({}, res, next, "507f1f77bcf86cd799439011");

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("battleRooms router — requireAuth wiring", () => {
  function middlewareNamesFor(path) {
    const layer = battleRoomsRouter.stack.find(
      (l) => l.route && l.route.path === path
    );
    if (!layer) throw new Error(`No route registered for ${path}`);
    return layer.route.stack.map((s) => s.name);
  }

  it("requires auth on POST /", () => {
    expect(middlewareNamesFor("/")).toContain("requireAuth");
  });

  it("keeps role authorization after authentication on POST /", () => {
    const layer = battleRoomsRouter.stack.find(
      (l) => l.route && l.route.path === "/"
    );
    if (!layer) throw new Error("No route registered for /");

    const stack = layer.route.stack;

    // Express receives requireAuth, the requireRole(...) middleware, and
    // finally the async route handler. requireRole returns an anonymous
    // middleware function, so its Express layer name is not "requireRole".
    // Assert the real middleware ordering instead of relying on a function
    // name that does not exist at runtime.
    expect(stack).toHaveLength(3);
    expect(stack[0].handle.name).toBe("requireAuth");
    expect(stack[1].handle).not.toBe(stack[0].handle);
    expect(stack[2].handle.constructor.name).toBe("AsyncFunction");
  });
});

describe("POST /api/battle-rooms — create", () => {
  let res;
  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
  });

  it("creates a room for a student without requiring college verification", async () => {
    Problem.countDocuments.mockResolvedValue(1);
    BattleRoom.findOne.mockReturnValue(queryResult(null));
    BattleRoom.create.mockResolvedValue(makeRoomDoc());

    const req = {
      body: { title: "My Room", problemSlugs: ["two-sum"], durationMinutes: 60 },
      userDoc: userDoc(),
      log: mockLog(),
    };
    await getHandler("post", "/")(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("allows an unverified student to host a Battle Room", async () => {
    Problem.countDocuments.mockResolvedValue(1);
    BattleRoom.findOne.mockReturnValue(queryResult(null));
    BattleRoom.create.mockResolvedValue(makeRoomDoc());

    const req = {
      body: { title: "My Room", problemSlugs: ["two-sum"], durationMinutes: 60 },
      userDoc: userDoc({ education: { emailVerified: false } }),
      log: mockLog(),
    };
    await getHandler("post", "/")(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(BattleRoom.create).toHaveBeenCalled();
  });

  it("rejects a student who already has an active/lobby hosted room", async () => {
    BattleRoom.findOne.mockReturnValue(queryResult({ _id: "existing" }));

    const req = {
      body: { title: "My Room", problemSlugs: ["two-sum"], durationMinutes: 60 },
      userDoc: userDoc(),
      log: mockLog(),
    };
    await getHandler("post", "/")(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(BattleRoom.create).not.toHaveBeenCalled();
  });

  it("does not let an expired active room block a new hosted room", async () => {
    BattleRoom.findOne.mockImplementation((filter) => {
      expect(filter.createdBy).toBe("user1");
      expect(filter.$or).toEqual(
        expect.arrayContaining([
          { status: "lobby" },
          { status: "active", endsAt: expect.objectContaining({ $gt: expect.any(Date) }) },
          { status: "active", endsAt: null },
        ])
      );
      return queryResult(null);
    });
    Problem.countDocuments.mockResolvedValue(1);
    BattleRoom.create.mockResolvedValue(makeRoomDoc());

    const req = {
      body: { title: "Replacement Room", problemSlugs: ["two-sum"], durationMinutes: 60 },
      userDoc: userDoc(),
      log: mockLog(),
    };
    await getHandler("post", "/")(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(BattleRoom.create).toHaveBeenCalled();
  });

  it("rejects a duration outside the 30min–4hr guardrail for students", async () => {
    BattleRoom.findOne.mockReturnValue(queryResult(null));

    const req = {
      body: { title: "My Room", problemSlugs: ["two-sum"], durationMinutes: 5 },
      userDoc: userDoc(),
      log: mockLog(),
    };
    await getHandler("post", "/")(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(BattleRoom.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid problem slug", async () => {
    BattleRoom.findOne.mockReturnValue(queryResult(null));
    Problem.countDocuments.mockResolvedValue(0); // slug doesn't exist

    const req = {
      body: { title: "My Room", problemSlugs: ["nonexistent"], durationMinutes: 60 },
      userDoc: userDoc(),
      log: mockLog(),
    };
    await getHandler("post", "/")(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(BattleRoom.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/battle-rooms/join", () => {
  let res;
  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
  });

  it("returns 400 without inviteCode — this route requires requireAuth upstream, so unauthenticated never reaches the handler; that's covered by middleware/auth.test.js", async () => {
    const req = { body: {}, userDoc: userDoc(), log: mockLog() };
    await getHandler("post", "/join")(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects an invalid invite code", async () => {
    BattleRoom.findOne.mockResolvedValue(null);
    const req = { body: { inviteCode: "ZZZZZZ" }, userDoc: userDoc(), log: mockLog() };
    await getHandler("post", "/join")(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("rejects joining a room that already started", async () => {
    BattleRoom.findOne.mockResolvedValue(makeRoomDoc({ status: "active" }));
    const req = { body: { inviteCode: "ABC123" }, userDoc: userDoc(), log: mockLog() };
    await getHandler("post", "/join")(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("succeeds for a fresh join", async () => {
    BattleRoom.findOne.mockResolvedValue(makeRoomDoc());
    // The actual join is now a single atomic findOneAndUpdate (see
    // routes/battleRooms.js's own comment on this handler for why) — the
    // initial findOne above is only used for the fast-path 404/already-
    // started/already-joined checks.
    BattleRoom.findOneAndUpdate.mockResolvedValue(makeRoomDoc());
    const req = { body: { inviteCode: "ABC123" }, userDoc: userDoc(), log: mockLog() };
    await getHandler("post", "/join")(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(BattleRoom.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "room1",
        status: "lobby",
        "roster.userId": { $ne: "user1" },
      }),
      expect.objectContaining({ $push: expect.objectContaining({ roster: expect.objectContaining({ userId: "user1" }) }) }),
      expect.objectContaining({ new: true })
    );
  });

  it("does not create a duplicate membership on a repeat join (idempotent)", async () => {
    const room = makeRoomDoc({ roster: [{ userId: { toString: () => "user1" }, teamIndex: null, solvedSlugs: [] }] });
    BattleRoom.findOne.mockResolvedValue(room);
    const req = { body: { inviteCode: "ABC123" }, userDoc: userDoc(), log: mockLog() };
    await getHandler("post", "/join")(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ alreadyJoined: true }));
    expect(room.save).not.toHaveBeenCalled();
  });

  it("rejects joining a full room", async () => {
    const fullRoster = Array.from({ length: 8 }, (_, i) => ({
      userId: { toString: () => `user${i}` }, teamIndex: null, solvedSlugs: [],
    }));
    BattleRoom.findOne.mockResolvedValue(makeRoomDoc({ roster: fullRoster, maxTeamSize: 4 }));
    // Full capacity → the atomic filter's $expr size guard genuinely
    // can't match anything, so findOneAndUpdate correctly returns null;
    // the handler then re-reads to report the specific 409 reason.
    BattleRoom.findOneAndUpdate.mockResolvedValue(null);
    BattleRoom.findById.mockReturnValue(queryResult({ status: "lobby", roster: fullRoster }));
    const req = { body: { inviteCode: "ABC123" }, userDoc: userDoc({ _id: "newUser" }), log: mockLog() };
    await getHandler("post", "/join")(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe("POST /api/battle-rooms/:id/assign-teams — ownership", () => {
  let res;
  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
  });

  it("returns 404 when the room doesn't exist", async () => {
    BattleRoom.findById.mockResolvedValue(null);
    const req = { params: { id: "room1" }, body: { mode: "random" }, userDoc: userDoc(), log: mockLog() };
    await getHandler("post", "/:id/assign-teams")(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("rejects a non-host trying to assign teams — cannot bypass by any client-sent field, ownership is a server-side comparison against createdBy", async () => {
    BattleRoom.findById.mockResolvedValue(makeRoomDoc({ createdBy: "host1" }));
    const req = {
      params: { id: "room1" }, body: { mode: "random" },
      userDoc: userDoc({ _id: "not-the-host" }), log: mockLog(),
    };
    await getHandler("post", "/:id/assign-teams")(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows the host to assign teams", async () => {
    const room = makeRoomDoc({
      createdBy: "user1",
      roster: [
        { userId: { toString: () => "a" }, teamIndex: null },
        { userId: { toString: () => "b" }, teamIndex: null },
      ],
    });
    BattleRoom.findById.mockResolvedValue(room);
    const req = {
      params: { id: "room1" }, body: { mode: "random" },
      userDoc: userDoc(), log: mockLog(),
    };
    await getHandler("post", "/:id/assign-teams")(req, res);

    expect(room.save).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it("rejects assigning teams after the match has already started", async () => {
    BattleRoom.findById.mockResolvedValue(makeRoomDoc({ createdBy: "user1", status: "active" }));
    const req = {
      params: { id: "room1" }, body: { mode: "random" },
      userDoc: userDoc(), log: mockLog(),
    };
    await getHandler("post", "/:id/assign-teams")(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("POST /api/battle-rooms/:id/start — ownership", () => {
  let res;
  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
  });

  it("rejects a non-host starting the match", async () => {
    BattleRoom.findById.mockResolvedValue(makeRoomDoc({ createdBy: "host1" }));
    const req = { params: { id: "room1" }, userDoc: userDoc({ _id: "not-the-host" }), log: mockLog() };
    await getHandler("post", "/:id/start")(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("rejects starting when a team has zero members", async () => {
    const room = makeRoomDoc({
      createdBy: "user1",
      roster: [{ userId: { toString: () => "a" }, teamIndex: 0 }],
    });
    BattleRoom.findById.mockResolvedValue(room);
    const req = { params: { id: "room1" }, userDoc: userDoc(), log: mockLog() };
    await getHandler("post", "/:id/start")(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(room.save).not.toHaveBeenCalled();
  });

  it("starts the match once both teams have at least one member", async () => {
    const room = makeRoomDoc({
      createdBy: "user1",
      roster: [
        { userId: { toString: () => "a" }, teamIndex: 0 },
        { userId: { toString: () => "b" }, teamIndex: 1 },
      ],
    });
    BattleRoom.findById.mockResolvedValue(room);
    const req = { params: { id: "room1" }, userDoc: userDoc(), log: mockLog() };
    await getHandler("post", "/:id/start")(req, res);

    expect(room.status).toBe("active");
    expect(room.save).toHaveBeenCalled();
  });

  it("rejects starting an already-started match", async () => {
    BattleRoom.findById.mockResolvedValue(makeRoomDoc({ createdBy: "user1", status: "active" }));
    const req = { params: { id: "room1" }, userDoc: userDoc(), log: mockLog() };
    await getHandler("post", "/:id/start")(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("GET /api/battle-rooms/:id — detail", () => {
  let res;
  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
  });

  it("returns 404 for a room that doesn't exist", async () => {
    BattleRoom.findById.mockReturnValue(queryResult(null));
    const req = { params: { id: "room1" }, userDoc: null, log: mockLog() };
    await getHandler("get", "/:id")(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("works for an unauthenticated caller (intentionally public detail view)", async () => {
    BattleRoom.findById.mockReturnValue(
      queryResult(makeRoomDoc({ createdBy: { toString: () => "host1" }, roster: [] }))
    );
    const req = { params: { id: "room1" }, userDoc: null, log: mockLog() };
    await getHandler("get", "/:id")(req, res);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ isHost: false, isJoined: false }));
  });

  it("does not expose the invite code or internal user ids to a non-host viewer", async () => {
    BattleRoom.findById.mockReturnValue(
      queryResult(
        makeRoomDoc({
          createdBy: { toString: () => "host1" },
          inviteCode: "SECRET1",
          roster: [
            {
              userId: { toString: () => "member1" },
              displayName: "Member One",
              teamIndex: 0,
              solvedSlugs: ["two-sum"],
            },
          ],
        })
      )
    );
    const req = { params: { id: "room1" }, userDoc: userDoc({ _id: "viewer1" }), log: mockLog() };
    await getHandler("get", "/:id")(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.inviteCode).toBeUndefined();
    expect(payload.createdBy).toBeUndefined();
    expect(payload.roster[0].userId).toBeUndefined();
  });

  it("returns the invite code and roster user ids to the authenticated host", async () => {
    BattleRoom.findById.mockReturnValue(
      queryResult(
        makeRoomDoc({
          createdBy: { toString: () => "user1" },
          inviteCode: "SECRET1",
          roster: [
            {
              userId: { toString: () => "member1" },
              displayName: "Member One",
              teamIndex: null,
              solvedSlugs: [],
            },
          ],
        })
      )
    );
    const req = { params: { id: "room1" }, userDoc: userDoc(), log: mockLog() };
    await getHandler("get", "/:id")(req, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.inviteCode).toBe("SECRET1");
    expect(payload.createdBy).toBeUndefined();
    expect(payload.roster[0].userId).toEqual({ toString: expect.any(Function) });
  });

  it("persists an expired active room as ended", async () => {
    const now = Date.now();
    BattleRoom.findById.mockReturnValue(
      queryResult(
        makeRoomDoc({
          createdBy: { toString: () => "host1" },
          status: "active",
          endsAt: new Date(now - 60_000),
          roster: [],
        })
      )
    );
    const req = { params: { id: "room1" }, userDoc: null, log: mockLog() };
    await getHandler("get", "/:id")(req, res);

    expect(BattleRoom.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "room1", status: "active", endsAt: { $lte: expect.any(Date) } },
      { $set: { status: "ended" } },
      { returnDocument: "after" }
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "ended" }));
  });
});

describe("POST /api/battle-rooms/:id/solve — legacy proof-required endpoint", () => {
  let res;
  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
  });

  it("rejects a forged Accepted claim with no matching Submission proof — the actual security fix", async () => {
    Submission.exists.mockResolvedValue(false);
    const req = {
      params: { id: "room1" }, body: { slug: "two-sum" },
      userDoc: userDoc(), log: mockLog(),
    };
    await getHandler("post", "/:id/solve")(req, res);

    expect(Submission.exists).toHaveBeenCalledWith({
      userId: "user1", problemSlug: "two-sum", battleRoomId: "room1", status: "Accepted",
    });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(awardBattleRoomSolve).not.toHaveBeenCalled();
  });

  it("awards credit once a real Accepted Submission proof exists", async () => {
    Submission.exists.mockResolvedValue(true);
    awardBattleRoomSolve.mockResolvedValue({
      ok: true, alreadySolvedPersonally: false, countedForTeam: true, teamScore: 100, teamIndex: 0,
    });
    const req = {
      params: { id: "room1" }, body: { slug: "two-sum" },
      userDoc: userDoc(), log: mockLog(),
    };
    await getHandler("post", "/:id/solve")(req, res);

    expect(awardBattleRoomSolve).toHaveBeenCalledWith({ battleRoomId: "room1", userId: "user1", slug: "two-sum" });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, countedForTeam: true }));
  });

  it("a Wrong Answer submission provides no proof, so no credit is awarded even with a battleRoomId present", async () => {
    Submission.exists.mockResolvedValue(false); // no Accepted row exists for this user/problem/room
    const req = {
      params: { id: "room1" }, body: { slug: "two-sum" },
      userDoc: userDoc(), log: mockLog(),
    };
    await getHandler("post", "/:id/solve")(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(awardBattleRoomSolve).not.toHaveBeenCalled();
  });

  it("proof for the WRONG problem does not grant credit for a different slug", async () => {
    // Submission.exists is called with the exact slug from the request —
    // a mismatched proof simply never matches the query.
    Submission.exists.mockResolvedValue(false);
    const req = {
      params: { id: "room1" }, body: { slug: "a-different-problem" },
      userDoc: userDoc(), log: mockLog(),
    };
    await getHandler("post", "/:id/solve")(req, res);

    expect(Submission.exists).toHaveBeenCalledWith(
      expect.objectContaining({ problemSlug: "a-different-problem" })
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("surfaces a room-side rejection (not active / not on a team / room not found) with the right status code", async () => {
    Submission.exists.mockResolvedValue(true);
    awardBattleRoomSolve.mockResolvedValue({ ok: false, reason: "battle_room_not_active" });
    const req = {
      params: { id: "room1" }, body: { slug: "two-sum" },
      userDoc: userDoc(), log: mockLog(),
    };
    await getHandler("post", "/:id/solve")(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("duplicate Accepted submissions cannot double-score — service layer reports idempotent no-op, route surfaces it as such", async () => {
    Submission.exists.mockResolvedValue(true);
    awardBattleRoomSolve.mockResolvedValue({
      ok: true, alreadySolvedPersonally: true, countedForTeam: false, teamScore: 100, teamIndex: 0,
    });
    const req = {
      params: { id: "room1" }, body: { slug: "two-sum" },
      userDoc: userDoc(), log: mockLog(),
    };
    await getHandler("post", "/:id/solve")(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, alreadySolvedPersonally: true }));
  });

  it("requires a slug in the body", async () => {
    const req = { params: { id: "room1" }, body: {}, userDoc: userDoc(), log: mockLog() };
    await getHandler("post", "/:id/solve")(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Submission.exists).not.toHaveBeenCalled();
  });
});

describe("POST /api/battle-rooms/:id/leave", () => {
  let res;
  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
  });

  it("removes a participant from the roster while still in the lobby", async () => {
    const room = makeRoomDoc({
      createdBy: "host1",
      roster: [{ userId: { toString: () => "user1" }, teamIndex: null, solvedSlugs: [] }],
    });
    BattleRoom.findById.mockResolvedValue(room);
    const req = { params: { id: "room1" }, userDoc: userDoc(), log: mockLog() };
    await getHandler("post", "/:id/leave")(req, res);

    expect(room.roster).toHaveLength(0);
    expect(room.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("rejects the host trying to leave their own room — they must cancel instead", async () => {
    const room = makeRoomDoc({ createdBy: "user1", roster: [{ userId: { toString: () => "user1" }, teamIndex: null }] });
    BattleRoom.findById.mockResolvedValue(room);
    const req = { params: { id: "room1" }, userDoc: userDoc(), log: mockLog() };
    await getHandler("post", "/:id/leave")(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(room.save).not.toHaveBeenCalled();
  });

  it("rejects leaving after the match has started", async () => {
    const room = makeRoomDoc({
      createdBy: "host1", status: "active",
      roster: [{ userId: { toString: () => "user1" }, teamIndex: 0 }],
    });
    BattleRoom.findById.mockResolvedValue(room);
    const req = { params: { id: "room1" }, userDoc: userDoc(), log: mockLog() };
    await getHandler("post", "/:id/leave")(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(room.save).not.toHaveBeenCalled();
  });

  it("rejects leaving a room the caller never joined", async () => {
    const room = makeRoomDoc({ createdBy: "host1", roster: [] });
    BattleRoom.findById.mockResolvedValue(room);
    const req = { params: { id: "room1" }, userDoc: userDoc(), log: mockLog() };
    await getHandler("post", "/:id/leave")(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("DELETE /api/battle-rooms/:id — host cancels a lobby room", () => {
  let res;
  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
  });

  it("rejects a non-host trying to cancel", async () => {
    BattleRoom.findById.mockResolvedValue(makeRoomDoc({ createdBy: "host1" }));
    const req = { params: { id: "room1" }, userDoc: userDoc({ _id: "not-the-host" }), log: mockLog() };
    await getHandler("delete", "/:id")(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(BattleRoom.deleteOne).not.toHaveBeenCalled();
  });

  it("lets the host cancel a lobby room, freeing the one-active-room slot", async () => {
    BattleRoom.findById.mockResolvedValue(makeRoomDoc({ createdBy: "user1", status: "lobby" }));
    const req = { params: { id: "room1" }, userDoc: userDoc(), log: mockLog() };
    await getHandler("delete", "/:id")(req, res);

    expect(BattleRoom.deleteOne).toHaveBeenCalledWith({ _id: "room1" });
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("rejects cancelling a room that has already started", async () => {
    BattleRoom.findById.mockResolvedValue(makeRoomDoc({ createdBy: "user1", status: "active" }));
    const req = { params: { id: "room1" }, userDoc: userDoc(), log: mockLog() };
    await getHandler("delete", "/:id")(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(BattleRoom.deleteOne).not.toHaveBeenCalled();
  });

  it("returns 404 for a room that doesn't exist", async () => {
    BattleRoom.findById.mockResolvedValue(null);
    const req = { params: { id: "room1" }, userDoc: userDoc(), log: mockLog() };
    await getHandler("delete", "/:id")(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});