import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../utils/cache.js", () => ({
  invalidateCachePrefix: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../models/College.js", () => ({
  default: { findByDomain: vi.fn() },
}));

import { invalidateCachePrefix } from "../utils/cache.js";
import College from "../models/College.js";
import { invalidateTpoCache } from "./tpoController.js";

describe("invalidateTpoCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no-ops without querying anything when no domain is given", async () => {
    await invalidateTpoCache(undefined);
    expect(College.findByDomain).not.toHaveBeenCalled();
    expect(invalidateCachePrefix).not.toHaveBeenCalled();
  });

  it("invalidates the students/dashboard cache prefixes for a single-domain college", async () => {
    College.findByDomain.mockResolvedValueOnce({ domains: ["mit.edu"] });

    await invalidateTpoCache("mit.edu");

    expect(invalidateCachePrefix).toHaveBeenCalledWith("tpo:students:mit.edu");
    expect(invalidateCachePrefix).toHaveBeenCalledWith("tpo:dashboard:mit.edu");
  });

  // ── TPO-1 closure fix ────────────────────────────────────────────────────
  it("invalidates the cache for EVERY domain of a multi-domain college, not just the changed student's own domain", async () => {
    College.findByDomain.mockResolvedValueOnce({ domains: ["mit.edu", "old-mit.edu"] });

    // A student on old-mit.edu changed — but a TPO registered under the
    // college's OTHER domain (mit.edu) has their /students and /dashboard
    // results cached under a "mit.edu"-keyed prefix. Without resolving the
    // full college and looping its domains, that TPO's cache entry would
    // never be invalidated and could serve stale data indefinitely.
    await invalidateTpoCache("old-mit.edu");

    expect(invalidateCachePrefix).toHaveBeenCalledWith("tpo:students:mit.edu");
    expect(invalidateCachePrefix).toHaveBeenCalledWith("tpo:dashboard:mit.edu");
    expect(invalidateCachePrefix).toHaveBeenCalledWith("tpo:students:old-mit.edu");
    expect(invalidateCachePrefix).toHaveBeenCalledWith("tpo:dashboard:old-mit.edu");
  });

  it("falls back to invalidating just the given domain when no College record resolves", async () => {
    College.findByDomain.mockResolvedValueOnce(null);

    await invalidateTpoCache("unrecognized.edu");

    expect(invalidateCachePrefix).toHaveBeenCalledWith("tpo:students:unrecognized.edu");
    expect(invalidateCachePrefix).toHaveBeenCalledWith("tpo:dashboard:unrecognized.edu");
  });

  it("falls back to invalidating just the given domain if the College lookup itself throws", async () => {
    College.findByDomain.mockRejectedValueOnce(new Error("db down"));

    await invalidateTpoCache("mit.edu");

    expect(invalidateCachePrefix).toHaveBeenCalledWith("tpo:students:mit.edu");
    expect(invalidateCachePrefix).toHaveBeenCalledWith("tpo:dashboard:mit.edu");
  });
});
