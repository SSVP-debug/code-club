import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/College.js", () => ({
  default: {
    findByIdAndUpdate: vi.fn(),
    findById: vi.fn(),
  },
}));

import College from "../models/College.js";
import {
  getInstitutionSubscription,
  isInstitutionSubscriptionActive,
  setInstitutionSubscription,
  cancelInstitutionSubscription,
} from "./institutionSubscriptionService.js";

describe("institutionSubscriptionService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("treats active subscriptions without expiry as active", () => {
    expect(
      isInstitutionSubscriptionActive({
        subscription: { plan: "pilot", status: "active", expiresAt: null },
      })
    ).toBe(true);
  });

  it("keeps cancelled subscriptions active until their paid expiry", () => {
    const future = new Date("2030-01-02T00:00:00.000Z");
    expect(
      isInstitutionSubscriptionActive({
        subscription: { plan: "college_yearly", status: "cancelled", expiresAt: future },
      }, new Date("2030-01-01T00:00:00.000Z"))
    ).toBe(true);

    expect(
      isInstitutionSubscriptionActive({
        subscription: { plan: "college_yearly", status: "cancelled", expiresAt: future },
      }, future)
    ).toBe(false);
  });

  it("returns a normalized inactive state for a college without a subscription", () => {
    expect(getInstitutionSubscription({})).toMatchObject({
      plan: "none",
      status: "none",
      isActive: false,
    });
  });

  it("rejects invalid institution plans before touching the database", async () => {
    await expect(
      setInstitutionSubscription("507f1f77bcf86cd799439011", { plan: "not_a_plan" })
    ).rejects.toMatchObject({ code: "INVALID_PLAN" });
    expect(College.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("writes a validated institution subscription", async () => {
    const saved = {
      _id: "college-1",
      subscription: {
        plan: "college_yearly",
        status: "active",
      },
    };
    College.findByIdAndUpdate.mockResolvedValue(saved);

    const result = await setInstitutionSubscription("507f1f77bcf86cd799439011", {
      plan: "college_yearly",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      provider: "manual",
    });

    expect(result).toBe(saved);
    expect(College.findByIdAndUpdate).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439011",
      expect.objectContaining({ $set: expect.objectContaining({
        subscription: expect.objectContaining({
          plan: "college_yearly",
          status: "active",
          provider: "manual",
        }),
      })),
      { new: true, runValidators: true }
    );
  });

  it("cancels an institution subscription without removing its expiry", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const college = {
      subscription: {
        plan: "college_monthly",
        status: "active",
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      },
      save,
    };
    College.findById.mockResolvedValue(college);

    await cancelInstitutionSubscription("507f1f77bcf86cd799439011", new Date("2029-12-01T00:00:00.000Z"));

    expect(college.subscription.status).toBe("cancelled");
    expect(college.subscription.expiresAt).toEqual(new Date("2030-01-01T00:00:00.000Z"));
    expect(save).toHaveBeenCalledOnce();
  });
});
