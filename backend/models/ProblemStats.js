import mongoose from "mongoose";

const problemStatsSchema = new mongoose.Schema(
  {
    problemSlug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    accepted: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastSubmissionAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// The acceptance-rate endpoint reads one small stats document per problem
// instead of scanning the ever-growing Submission collection.
problemStatsSchema.index({ problemSlug: 1 }, { unique: true });

const ProblemStats = mongoose.model("ProblemStats", problemStatsSchema);

export default ProblemStats;
