import mongoose from "mongoose";

/**
 * One immutable review record per TPO role application decision.
 * This is deliberately separate from User/College state so the audit trail
 * survives later edits, role revocation, or college renames.
 */
const tpoVerificationReviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "College",
      required: true,
      index: true,
    },
    requestedEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    emailRoleSignal: {
      type: String,
      enum: ["staff_candidate", "student_candidate", "ambiguous", "unknown"],
      required: true,
    },
    evidence: {
      type: [
        {
          kind: {
            type: String,
            enum: ["email", "invitation", "staff_id", "document", "manual_note"],
            required: true,
          },
          label: { type: String, required: true, trim: true, maxlength: 120 },
          reference: { type: String, default: null, trim: true, maxlength: 500 },
          note: { type: String, default: null, trim: true, maxlength: 1000 },
          addedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    decision: {
      type: String,
      enum: ["approved", "rejected"],
      required: true,
    },
    decisionReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reviewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("TpoVerificationReview", tpoVerificationReviewSchema);
