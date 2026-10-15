import mongoose from "mongoose";

const contestParticipantSchema = new mongoose.Schema({
  contestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Contest",
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  username: { type: String, default: "" },
  displayName: { type: String, default: "" },
  solvedSlugs: [{ type: String }],
  score: { type: Number, default: 0 },
  rank: { type: Number, default: null },
  joinedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// One participation record per user per contest. This is the primary
// identity constraint that replaces the old embedded participants[] array.
contestParticipantSchema.index({ contestId: 1, userId: 1 }, { unique: true });

// Leaderboard reads: highest score first, then earliest join time for the
// same deterministic tie-break used by the legacy contest ranking code.
contestParticipantSchema.index({ contestId: 1, score: -1, joinedAt: 1, _id: 1 });

// Profile/history lookup: find contests a user participated in without
// scanning Contest documents or their old embedded arrays.
contestParticipantSchema.index({ userId: 1, contestId: 1 });

export default mongoose.model("ContestParticipant", contestParticipantSchema);
