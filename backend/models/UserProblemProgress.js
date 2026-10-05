import mongoose from "mongoose";

const userProblemProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    problemSlug: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["attempted", "solved"],
      default: "attempted",
      index: true,
    },
    firstAttemptAt: {
      type: Date,
      default: Date.now,
    },
    solvedAt: {
      type: Date,
      default: null,
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    acceptedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    bestRuntime: {
      type: Number,
      default: null,
      min: 0,
    },
    bestMemory: {
      type: Number,
      default: null,
      min: 0,
    },
    lastAttemptAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// One row per student/problem. This is the scalable replacement for keeping
// an ever-growing solvedSlugs array as the primary per-problem store.
userProblemProgressSchema.index({ userId: 1, problemSlug: 1 }, { unique: true });
userProblemProgressSchema.index({ userId: 1, status: 1, lastAttemptAt: -1 });
userProblemProgressSchema.index({ problemSlug: 1, status: 1 });

const UserProblemProgress = mongoose.model(
  "UserProblemProgress",
  userProblemProgressSchema
);

export default UserProblemProgress;
