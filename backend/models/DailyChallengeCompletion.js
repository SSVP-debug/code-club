import mongoose from "mongoose";

const dailyChallengeCompletionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    slug: { type: String, required: true },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

dailyChallengeCompletionSchema.index({ userId: 1, date: 1 }, { unique: true });
dailyChallengeCompletionSchema.index({ userId: 1, completedAt: -1 });

export default mongoose.model("DailyChallengeCompletion", dailyChallengeCompletionSchema);
