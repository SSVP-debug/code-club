import mongoose from "mongoose";

const dailyChallengeCompletionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

dailyChallengeCompletionSchema.index({ userId: 1, date: 1, slug: 1 }, { unique: true });
dailyChallengeCompletionSchema.index({ userId: 1, date: -1 });

export default mongoose.model("DailyChallengeCompletion", dailyChallengeCompletionSchema);
