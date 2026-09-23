/**
 * PlacementVisibilityAuditLog — append-only audit trail for student changes
 * to institutional placement visibility. This is separate from AdminAuditLog:
 * the actor is the student, not an administrator.
 */
import mongoose from "mongoose";

const placementVisibilityAuditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    previousValue: { type: Boolean, required: true },
    newValue: { type: Boolean, required: true },
    source: { type: String, default: "student_settings" },
  },
  { timestamps: true }
);

placementVisibilityAuditLogSchema.index({ userId: 1, createdAt: -1 });

const PlacementVisibilityAuditLog = mongoose.model(
  "PlacementVisibilityAuditLog",
  placementVisibilityAuditLogSchema
);

export default PlacementVisibilityAuditLog;
