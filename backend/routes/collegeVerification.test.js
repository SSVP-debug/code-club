import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/User.js", () => ({
  default: { findById: vi.fn() },
}));
vi.mock("../models/College.js", () => ({
  default: { findByDomain: vi.fn(), findOneAndUpdate: vi.fn(), findById: vi.fn() },
}));
vi.mock("../utils/domainVerification.js", () => ({
  isDomainAutoVerified: vi.fn(),
  isConsumerEmailDomain: vi.fn(),
}));
vi.mock("../config/resend.js", () => ({
  getResendClient: vi.fn(),
  getFromAddress: vi.fn(() => "Code Club <verify@codeclub.in>"),
}));
vi.mock("../config/site.js", () => ({
  SITE_URL: "https://code-club-one.vercel.app",
  SUPPORT_EMAIL: "connect.codeclub@gmail.com",
}));
vi.mock("../middleware/rateLimiter.js", () => ({
  // Pass-through middleware for unit tests — rate limiting itself is
  // exercised only implicitly here; its window/threshold logic belongs to
  // express-rate-limit, not this route.
  collegeVerificationResendLimiter: (req, res, next) => next(),
}));

import User from "../models/User.js";
import College from "../models/College.js";
import { isDomainAutoVerified, isConsumerEmailDomain } from "../utils/domainVerification.js";
import { getResendClient } from "../config/resend.js";
import collegeVerificationRouter from "./collegeVerification.js";

function getHandler(method, path) {
  const layer = collegeVerificationRouter.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method]
  );
  if (!layer) throw new Error(`No ${method.toUpperCase()} route registered for path ${path}`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function makeUserDoc(overrides = {}) {
  return {
    _id: "u1",
    displayName: "Priya",
    education: {},
    save: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("collegeVerification.js — POST /request", () => {
  let req, res;

  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
    isConsumerEmailDomain.mockReturnValue(false);
    getResendClient.mockResolvedValue({
      emails: { send: vi.fn().mockResolvedValue({ error: null }) },
    });
  });

  it("sends verification immediately for a recognized domain, without creating a College record", async () => {
    isDomainAutoVerified.mockResolvedValue(true);
    const userDoc = makeUserDoc();
    req = { body: { collegeEmail: "student@marwadiuniversity.ac.in" }, userDoc };

    const handler = getHandler("post", "/request");
    await handler(req, res);

    expect(College.findOneAndUpdate).not.toHaveBeenCalled();
    expect(userDoc.education.collegeStatus).toBe("unset"); // flips on confirm, not request
    expect(userDoc.education.emailVerified).toBe(false);
    expect(userDoc.save).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, collegeRecognized: true })
    );
  });

  it("creates a pending College record for an unrecognized domain when a college name is provided", async () => {
    isDomainAutoVerified.mockResolvedValue(false);
    College.findByDomain.mockResolvedValue(null);
    College.findOneAndUpdate.mockResolvedValue({
      _id: "c1",
      name: "XYZ Institute of Technology",
      status: "pending",
    });
    const userDoc = makeUserDoc();
    req = {
      body: {
        collegeEmail: "student@xyzcollege.ac.in",
        collegeName: "XYZ Institute of Technology",
        collegeWebsite: "https://xyzcollege.ac.in",
      },
      userDoc,
    };

    const handler = getHandler("post", "/request");
    await handler(req, res);

    expect(College.findOneAndUpdate).toHaveBeenCalledWith(
      { domains: "xyzcollege.ac.in" },
      expect.objectContaining({ $setOnInsert: expect.objectContaining({ status: "pending" }) }),
      expect.objectContaining({ upsert: true })
    );
    expect(userDoc.education.collegeId).toBe("c1");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, collegeRecognized: false, collegeName: "XYZ Institute of Technology" })
    );
  });

  it("400s with COLLEGE_NAME_REQUIRED when the domain is unrecognized and no college name was given — this is the modal's cue to switch state, not a dead end", async () => {
    isDomainAutoVerified.mockResolvedValue(false);
    req = { body: { collegeEmail: "student@xyzcollege.ac.in" }, userDoc: makeUserDoc() };

    const handler = getHandler("post", "/request");
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "COLLEGE_NAME_REQUIRED" }));
    expect(College.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("400s for a consumer email domain and never attempts college creation", async () => {
    isConsumerEmailDomain.mockReturnValue(true);
    req = { body: { collegeEmail: "student@gmail.com", collegeName: "Anything" }, userDoc: makeUserDoc() };

    const handler = getHandler("post", "/request");
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(isDomainAutoVerified).not.toHaveBeenCalled();
    expect(College.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("400s for a malformed email address", async () => {
    req = { body: { collegeEmail: "not-an-email" }, userDoc: makeUserDoc() };

    const handler = getHandler("post", "/request");
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("409s when the domain was already reviewed and rejected — does not silently re-queue it", async () => {
    isDomainAutoVerified.mockResolvedValue(false);
    College.findByDomain.mockResolvedValue({ _id: "c-old", status: "rejected" });
    req = {
      body: { collegeEmail: "student@bad-actor-college.com", collegeName: "Bad Actor College" },
      userDoc: makeUserDoc(),
    };

    const handler = getHandler("post", "/request");
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(College.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("reuses an existing pending College record rather than creating a duplicate for the same domain", async () => {
    isDomainAutoVerified.mockResolvedValue(false);
    College.findByDomain.mockResolvedValue({
      _id: "c1",
      name: "XYZ Institute of Technology",
      status: "pending",
    });
    req = {
      body: { collegeEmail: "student2@xyzcollege.ac.in", collegeName: "XYZ Institute of Technology" },
      userDoc: makeUserDoc(),
    };

    const handler = getHandler("post", "/request");
    await handler(req, res);

    expect(College.findOneAndUpdate).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, collegeRecognized: false }));
  });
});

describe("collegeVerification.js — POST /resend", () => {
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
    getResendClient.mockResolvedValue({
      emails: { send: vi.fn().mockResolvedValue({ error: null }) },
    });
  });

  it("400s when there is no pending verification to resend", async () => {
    const req = { userDoc: makeUserDoc({ education: {} }) };
    const handler = getHandler("post", "/resend");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("400s when the email is already verified", async () => {
    const req = { userDoc: makeUserDoc({ education: { collegeEmail: "a@b.edu", emailVerified: true } }) };
    const handler = getHandler("post", "/resend");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("generates a new token and resends on the happy path", async () => {
    const userDoc = makeUserDoc({ education: { collegeEmail: "a@b.edu", emailVerified: false, verifyToken: "old" } });
    const req = { userDoc };
    const handler = getHandler("post", "/resend");
    await handler(req, res);

    expect(userDoc.education.verifyToken).not.toBe("old");
    expect(userDoc.save).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

describe("collegeVerification.js — GET /confirm", () => {
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    res = mockRes();
  });

  it("400s on an invalid/mismatched token", async () => {
    User.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue({ education: { verifyToken: "real-token", verifyTokenExpiresAt: new Date(Date.now() + 1000) } }),
    });
    const req = { query: { token: "wrong-token" }, userDoc: { _id: "u1" } };
    const handler = getHandler("get", "/confirm");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("400s on an expired token", async () => {
    User.findById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        education: { verifyToken: "tok", verifyTokenExpiresAt: new Date(Date.now() - 1000) },
      }),
    });
    const req = { query: { token: "tok" }, userDoc: { _id: "u1" } };
    const handler = getHandler("get", "/confirm");
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("sets collegeStatus verified for the recognized-domain path (no collegeId link)", async () => {
    const user = {
      education: {
        verifyToken: "tok",
        verifyTokenExpiresAt: new Date(Date.now() + 100000),
        collegeId: null,
        collegeName: "Marwadi University",
      },
      save: vi.fn().mockResolvedValue(true),
    };
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(user) });
    const req = { query: { token: "tok" }, userDoc: { _id: "u1" } };
    const handler = getHandler("get", "/confirm");
    await handler(req, res);

    expect(user.education.emailVerified).toBe(true);
    expect(user.education.collegeStatus).toBe("verified");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ collegeStatus: "verified" }));
  });

  it("re-reads live College.status for a pending-college link — still pending", async () => {
    const user = {
      education: {
        verifyToken: "tok",
        verifyTokenExpiresAt: new Date(Date.now() + 100000),
        collegeId: "c1",
        collegeName: "XYZ Institute",
      },
      save: vi.fn().mockResolvedValue(true),
    };
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(user) });
    College.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ status: "pending" }) });

    const req = { query: { token: "tok" }, userDoc: { _id: "u1" } };
    const handler = getHandler("get", "/confirm");
    await handler(req, res);

    expect(user.education.collegeStatus).toBe("pending");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ collegeStatus: "pending" }));
  });

  it("re-reads live College.status for a pending-college link — was approved in between request and confirm", async () => {
    const user = {
      education: {
        verifyToken: "tok",
        verifyTokenExpiresAt: new Date(Date.now() + 100000),
        collegeId: "c1",
        collegeName: "XYZ Institute",
      },
      save: vi.fn().mockResolvedValue(true),
    };
    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(user) });
    College.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ status: "verified" }) });

    const req = { query: { token: "tok" }, userDoc: { _id: "u1" } };
    const handler = getHandler("get", "/confirm");
    await handler(req, res);

    expect(user.education.collegeStatus).toBe("verified");
  });
});