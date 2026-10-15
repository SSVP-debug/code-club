import mongoose from "mongoose";

const userSavedProblemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  problemSlug: { type: String, required: true, trim: true },
  savedAt: { type: Date, default: Date.now },
}, { timestamps: true });

userSavedProblemSchema.index({ userId: 1, problemSlug: 1 }, { unique: true });
userSavedProblemSchema.index({ userId: 1, savedAt: -1 });

export default mongoose.model("UserSavedProblem", userSavedProblemSchema);
