import mongoose from "mongoose";

const institutionBillingEventSchema = new mongoose.Schema(
  {
    providerEventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    event: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "College",
      default: null,
      index: true,
    },
    providerOrderId: {
      type: String,
      default: null,
      trim: true,
    },
    providerPaymentId: {
      type: String,
      default: null,
      trim: true,
    },
    providerSubscriptionId: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ["received", "processed", "failed"],
      default: "received",
      index: true,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("InstitutionBillingEvent", institutionBillingEventSchema);
