import { describe, expect, it, beforeAll, afterEach, afterAll } from "vitest";
import mongoose from "mongoose";
import { startTestMongo, clearTestMongo, stopTestMongo } from "../test/mongoMemoryServer.js";
import BattleRoom from "../models/BattleRoom.js";
import User from "../models/User.js";
import Problem from "../models/Problem.js";
import battleRoomsRouter from "./battleRooms.js";

function getRouteStack(method, path) {
  const layer = battleRoomsRouter.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method]
  );
  if (!layer) throw new Error(`No ${method.toUpperCase()} ${path} route`);
  return layer.route.stack.map((entry) => entry.handle);
}

function getHandler(method, path) {
  const stack = getRouteStack(method, path);
  return stack[stack.length - 1];
}

function mockRes() {
  const res = { _status: 200, _json: null };
  res.status = (code) => {
    res._status = code;
    return res;
  };
  res.json = (body) => {
    res._json = body;
    return res;
  };
  return res;
}

function nextSpy() {
  const state = { called: false };
  return { state, next: () => { state.called = true; } };
}

async function seedUser(overrides = {}) {
  return User.create({
    firebaseUid: `fb-${Math.random().toString(36).slice(2)}`,
    email: `${Math.random().toString(36).slice(2)}@test.com`,
    ...overrides,
  });
}

async function seedRoom({
  host,
  roster = [],
  status = "lobby",
  endsAt = null,
  maxTeamSize = 4,
  updatedAt,
} = {}) {
  return BattleRoom.create({
    title: "Hardening Room",
    description: "integration",
    createdBy: host._id,
    inviteCode: Math.random().toString(16).slice(2, 8).padEnd(6, "A").slice(0, 6).toUpperCase(),
    status,
    problemSlugs: ["two-sum"],
    maxTeamSize,
    durationMs: 30 * 60_000,
    startsAt: status === "active" ? new Date(Date.now() - 60_000) : null,
    endsAt,
    roster,
    teams: [
      { name: "Team Alpha", score: 0, solvedSlugs: [] },
      { name: "Team Beta", score: 0, solvedSlugs: [] },
    ],
    ...(updatedAt ? { updatedAt } : {}),
  });
}

describe("Battle Room hardening — BR-10..BR-13", () => {
  beforeAll(async () => {
    await startTestMongo();
  }, 60_000);

  afterEach(async () => {
    await clearTestMongo();
  });

  afterAll(async () => {
    await stopTestMongo();
  });

  describe("BR-10 middleware integration", () => {
    it("keeps authentication, role authorization, validation, then handler in that order on create", () => {
      const stack = getRouteStack("post", "/");
      expect(stack).toHaveLength(4);
      expect(stack[0].name).toBe("requireAuth");
      expect(stack[1]).not.toBe(stack[0]);
      expect(stack[2]).not.toBe(stack[1]);
      expect(stack[3].constructor.name).toBe("AsyncFunction");
    });

    it("blocks a disallowed role before validation or handler execution", () => {
      const stack = getRouteStack("post", "/");
      const res = mockRes();
      const { state, next } = nextSpy();

      stack[1]({ userDoc: { role: "recruiter" } }, res, next);

      expect(res._status).toBe(403);
      expect(state.called).toBe(false);
    });

    it("runs role authorization and body validation as one chain before create", async () => {
      const stack = getRouteStack("post", "/");
      const res = mockRes();
      const req = {
        body: {
          title: "  Chain Room  ",
          problemSlugs: ["two-sum"],
          durationMinutes: "30",
        },
        userDoc: {
          _id: new mongoose.Types.ObjectId(),
          role: "student",
        },
      };

      await new Promise((resolve) => {
        stack[1](req, res, () => stack[2](req, res, resolve));
      });

      expect(req.body.durationMinutes).toBe(30);
      expect(req.body.title).toBe("Chain Room");
      expect(res._status).toBe(200);
    });
  });

  describe("BR-11 expiry lifecycle regression", () => {
    it("persists an expired active room as ended and allows the same host to create a replacement", async () => {
      const host = await seedUser({ role: "student" });
      const expired = await seedRoom({
        host,
        status: "active",
        endsAt: new Date(Date.now() - 1_000),
      });

      const getRes = mockRes();
      await getHandler("get", "/:id")(
        { params: { id: expired._id.toString() }, userDoc: null },
        getRes
      );

      expect(getRes._status).toBe(200);
      expect(getRes._json.status).toBe("ended");

      const persisted = await BattleRoom.findById(expired._id).lean();
      expect(persisted.status).toBe("ended");

      await Problem.create({
        id: 999001,
        title: "Two Sum",
        slug: "two-sum",
        functionName: "twoSum",
        difficulty: "Easy",
        topic: "Arrays",
        description: "Integration fixture.",
      });

      const createRes = mockRes();
      await getHandler("post", "/")(
        {
          body: {
            title: "Replacement",
            problemSlugs: ["two-sum"],
            durationMinutes: 30,
          },
          userDoc: host,
        },
        createRes
      );

      expect(createRes._status).toBe(201);
    });
  });

  describe("BR-12 public DTO/security regression", () => {
    it("never exposes host identity, invite code, or roster user ids to public viewers", async () => {
      const host = await seedUser({ role: "student" });
      const member = await seedUser({ role: "student" });
      const room = await seedRoom({
        host,
        roster: [
          {
            userId: member._id,
            username: "hidden",
            displayName: "Member",
            teamIndex: 0,
            solvedSlugs: [],
          },
        ],
      });

      const res = mockRes();
      await getHandler("get", "/:id")(
        { params: { id: room._id.toString() }, userDoc: null },
        res
      );

      expect(res._status).toBe(200);
      expect(res._json.createdBy).toBeUndefined();
      expect(res._json.inviteCode).toBeUndefined();
      expect(res._json.roster[0].userId).toBeUndefined();
      expect(res._json.roster[0].displayName).toBe("Member");
    });

    it("only exposes invite code and roster ids to the authenticated host", async () => {
      const host = await seedUser({ role: "student" });
      const member = await seedUser({ role: "student" });
      const room = await seedRoom({
        host,
        roster: [
          {
            userId: member._id,
            username: "member",
            displayName: "Member",
            teamIndex: 0,
            solvedSlugs: [],
          },
        ],
      });

      const res = mockRes();
      await getHandler("get", "/:id")(
        { params: { id: room._id.toString() }, userDoc: host },
        res
      );

      expect(res._status).toBe(200);
      expect(res._json.inviteCode).toBe(room.inviteCode);
      expect(res._json.createdBy).toBeUndefined();
      expect(res._json.roster[0].userId.toString()).toBe(member._id.toString());
    });
  });

  describe("BR-13 concurrency regression", () => {
    it("allows only one concurrent host start against the same lobby snapshot", async () => {
      const host = await seedUser({ role: "student" });
      const a = await seedUser({ role: "student" });
      const b = await seedUser({ role: "student" });
      const room = await seedRoom({
        host,
        roster: [
          { userId: a._id, displayName: "A", teamIndex: 0, solvedSlugs: [] },
          { userId: b._id, displayName: "B", teamIndex: 1, solvedSlugs: [] },
        ],
      });

      const start = getHandler("post", "/:id/start");
      const resA = mockRes();
      const resB = mockRes();

      await Promise.all([
        start({ params: { id: room._id.toString() }, userDoc: host }, resA),
        start({ params: { id: room._id.toString() }, userDoc: host }, resB),
      ]);

      expect([resA._status, resB._status].filter((s) => s === 200)).toHaveLength(1);
      expect([resA._status, resB._status].filter((s) => s === 409)).toHaveLength(1);
      expect((await BattleRoom.findById(room._id)).status).toBe("active");
    });

    it("rejects a stale team assignment after another write advances updatedAt", async () => {
      const host = await seedUser({ role: "student" });
      const a = await seedUser({ role: "student" });
      const b = await seedUser({ role: "student" });
      const room = await seedRoom({
        host,
        roster: [
          { userId: a._id, displayName: "A", teamIndex: null, solvedSlugs: [] },
          { userId: b._id, displayName: "B", teamIndex: null, solvedSlugs: [] },
        ],
      });

      const staleUpdatedAt = room.updatedAt;
      const filter = {
        _id: room._id,
        createdBy: host._id,
        status: "lobby",
        updatedAt: staleUpdatedAt,
      };

      const first = await BattleRoom.findOneAndUpdate(
        filter,
        {
          $set: {
            "roster.0.teamIndex": 0,
            "roster.1.teamIndex": 1,
          },
        },
        { new: true }
      );

      expect(first).not.toBeNull();
      expect(first.roster[0].teamIndex).toBe(0);
      expect(first.roster[1].teamIndex).toBe(1);

      const staleSecond = await BattleRoom.findOneAndUpdate(
        filter,
        {
          $set: {
            "roster.0.teamIndex": 1,
            "roster.1.teamIndex": 0,
          },
        },
        { new: true }
      );

      expect(staleSecond).toBeNull();

      const persisted = await BattleRoom.findById(room._id).lean();
      expect(persisted.roster[0].teamIndex).toBe(0);
      expect(persisted.roster[1].teamIndex).toBe(1);
      expect(persisted.updatedAt.getTime()).toBeGreaterThan(staleUpdatedAt.getTime());
    });

    it("keeps concurrent leave operations atomic and never resurrects a member", async () => {
      const host = await seedUser({ role: "student" });
      const member = await seedUser({ role: "student" });
      const room = await seedRoom({
        host,
        roster: [
          {
            userId: member._id,
            displayName: "Member",
            teamIndex: null,
            solvedSlugs: [],
          },
        ],
      });

      const leave = getHandler("post", "/:id/leave");
      const resA = mockRes();
      const resB = mockRes();

      await Promise.all([
        leave({ params: { id: room._id.toString() }, userDoc: member }, resA),
        leave({ params: { id: room._id.toString() }, userDoc: member }, resB),
      ]);

      expect([resA._status, resB._status].filter((s) => s === 200)).toHaveLength(1);
      expect([resA._status, resB._status].filter((s) => s === 400)).toHaveLength(1);

      const persisted = await BattleRoom.findById(room._id).lean();
      expect(persisted.roster).toHaveLength(0);
    });
  });
});
