import PlacementVisibilityAuditLog from "../models/PlacementVisibilityAuditLog.js";
import { logger } from "../config/logger.js";

/**
 * Record a student-controlled institutional visibility change.
 * Logging is deliberately fire-and-forget: an audit-store outage must never
 * turn a successful privacy preference change into a failed user request.
 */
export function recordPlacementVisibilityChange({ userId, previousValue, newValue }) {
  return PlacementVisibilityAuditLog.create({
    userId,
    previousValue,
    newValue,
    source: "student_settings",
  }).catch((err) => {
    logger.warn({ err, userId }, "[placementVisibilityAuditLog] failed to record change");
  });
}
