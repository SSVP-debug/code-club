import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

async function freshHealthController() {
  vi.resetModules();
  return import("./healthController.js");
}

describe("getCompilerHealth", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns 200 with a healthy configuration outside production", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.JUDGE0_API_URL;
    const { getCompilerHealth } = await freshHealthController();
    const res = mockRes();

    getCompilerHealth({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.configuration.healthy).toBe(true);
  });

  it("returns 503 in production when defaulting to the public Judge0 endpoint", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.JUDGE0_API_URL;
    const { getCompilerHealth } = await freshHealthController();
    const res = mockRes();

    getCompilerHealth({}, res);

    expect(res.status).toHaveBeenCalledWith(503);
    const body = res.json.mock.calls[0][0];
    expect(body.configuration.healthy).toBe(false);
    expect(body.configuration.usingPublicSharedEndpoint).toBe(true);
  });

  it("returns 503 in production when explicitly pointed at ce.judge0.com", async () => {
    process.env.NODE_ENV = "production";
    process.env.JUDGE0_API_URL = "https://ce.judge0.com";
    const { getCompilerHealth } = await freshHealthController();
    const res = mockRes();

    getCompilerHealth({}, res);

    expect(res.status).toHaveBeenCalledWith(503);
  });

  it("returns 200 in production when pointed at a dedicated instance", async () => {
    process.env.NODE_ENV = "production";
    process.env.JUDGE0_API_URL = "https://judge0.internal.codeclub.example";
    const { getCompilerHealth } = await freshHealthController();
    const res = mockRes();

    getCompilerHealth({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("still includes the runtime request/success/failure counters alongside configuration", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.JUDGE0_API_URL;
    const { getCompilerHealth } = await freshHealthController();
    const res = mockRes();

    getCompilerHealth({}, res);

    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty("requests");
    expect(body).toHaveProperty("successes");
    expect(body).toHaveProperty("failures");
    expect(body).toHaveProperty("circuitOpen");
  });
});
