import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getJudge0ConfigStatus } from "./judge0.js";

const ORIGINAL_ENV = { ...process.env };

describe("getJudge0ConfigStatus", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe("development / non-production", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "test";
    });

    it("is healthy with no JUDGE0_API_URL set (falls back to public instance, fine for dev)", () => {
      delete process.env.JUDGE0_API_URL;
      const status = getJudge0ConfigStatus();
      expect(status.healthy).toBe(true);
      expect(status.usingPublicSharedEndpoint).toBe(true);
    });

    it("is healthy pointed at the public instance outside production", () => {
      process.env.JUDGE0_API_URL = "https://ce.judge0.com";
      const status = getJudge0ConfigStatus();
      expect(status.healthy).toBe(true);
      expect(status.usingPublicSharedEndpoint).toBe(true);
    });

    it("is unhealthy for a malformed URL regardless of environment", () => {
      process.env.JUDGE0_API_URL = "not a url";
      const status = getJudge0ConfigStatus();
      expect(status.healthy).toBe(false);
      expect(status.reason).toMatch(/not a valid URL/);
    });
  });

  describe("production", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("is UNHEALTHY with no JUDGE0_API_URL set (silently defaults to the public instance)", () => {
      delete process.env.JUDGE0_API_URL;
      const status = getJudge0ConfigStatus();
      expect(status.healthy).toBe(false);
      expect(status.usingPublicSharedEndpoint).toBe(true);
      expect(status.reason).toMatch(/ce\.judge0\.com/);
    });

    it("is UNHEALTHY when explicitly pointed at ce.judge0.com", () => {
      process.env.JUDGE0_API_URL = "https://ce.judge0.com";
      const status = getJudge0ConfigStatus();
      expect(status.healthy).toBe(false);
      expect(status.usingPublicSharedEndpoint).toBe(true);
      expect(status.reason).toMatch(/rate-limited and shared/);
    });

    it("is healthy when pointed at a dedicated/self-hosted instance", () => {
      process.env.JUDGE0_API_URL = "https://judge0.internal.codeclub.example";
      const status = getJudge0ConfigStatus();
      expect(status.healthy).toBe(true);
      expect(status.usingPublicSharedEndpoint).toBe(false);
      expect(status.reason).toBeNull();
    });

    it("is healthy when pointed at RapidAPI's Judge0 host", () => {
      process.env.JUDGE0_API_URL = "https://judge0-ce.p.rapidapi.com";
      const status = getJudge0ConfigStatus();
      expect(status.healthy).toBe(true);
      expect(status.usingPublicSharedEndpoint).toBe(false);
    });

    it("is unhealthy for a malformed URL", () => {
      process.env.JUDGE0_API_URL = "not a url";
      const status = getJudge0ConfigStatus();
      expect(status.healthy).toBe(false);
    });
  });
});
