import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../models/PlacementVisibilityAuditLog.js", () => ({
  default: { create: vi.fn() },
}));

vi.mock("../config/logger.js", () => ({
  logger: { warn: vi.fn() },
}));

import PlacementVisibilityAuditLog from "../models/PlacementVisibilityAuditLog.js";
import { logger } from "../config/logger.js";
import { recordPlacementVisibilityChange } from "./placementVisibilityAuditLog.js";

describe("placementVisibilityAuditLog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records the actor and both visibility values", async () => {
    PlacementVisibilityAuditLog.create.mockResolvedValue({});

    await recordPlacementVisibilityChange({
      userId: "507f1f77bcf86cd799439011",
      previousValue: true,
      newValue: false,
    });

    expect(PlacementVisibilityAuditLog.create).toHaveBeenCalledWith({
      userId: "507f1f77bcf86cd799439011",
      previousValue: true,
      newValue: false,
      source: "student_settings",
    });
  });

  it("does not reject the privacy change when audit persistence fails", async () => {
    const error = new Error("audit store unavailable");
    PlacementVisibilityAuditLog.create.mockRejectedValue(error);

    await expect(
      recordPlacementVisibilityChange({
        userId: "507f1f77bcf86cd799439011",
        previousValue: false,
        newValue: true,
      })
    ).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      { err: error, userId: "507f1f77bcf86cd799439011" },
      "[placementVisibilityAuditLog] failed to record change"
    );
  });
});
