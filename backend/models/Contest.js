import mongoose from "mongoose";
import ContestParticipant from "./ContestParticipant.js";

const contestParticipantFields = {
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  username:    { type: String },
  displayName: { type: String },
  solvedSlugs: [{ type: String }],
  score:       { type: Number, default: 0 },
  rank:        { type: Number, default: null },
  joinedAt:    { type: Date, default: Date.now },
};

const contestSchema = new mongoose.Schema({
  title:        { type: String, required: true },
  description:  { type: String, default: "" },
  type:         { type: String, enum: ["public", "private"], default: "public" },
  status:       { type: String, enum: ["upcoming","active","ended"], default: "upcoming" },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  inviteCode:   { type: String, unique: true, sparse: true },
  collegeDomain:{ type: String, default: null },
  maxParticipants: { type: Number, default: null },
  allowLateJoin:    { type: Boolean, default: true },
  startsAt:     { type: Date, required: true },
  endsAt:       { type: Date, required: true },
  durationMs:   { type: Number },
  problemSlugs: [{ type: String }],

  // Temporary legacy field for zero-downtime migration. The application no
  // longer reads this field. New writes are redirected to ContestParticipant,
  // and migrateContestParticipants.js unsets it on existing documents.
  participants: [contestParticipantFields],
}, { timestamps: true });

contestSchema.index({ status: 1, startsAt: 1 });

// Compatibility for old fixtures/tools that still create a Contest with an
// embedded participant list. Redirect that write to the scalable collection
// before the parent document is persisted. Normal application routes now
// write ContestParticipant directly and never touch this hook.
contestSchema.pre("save", async function() {
  if (!this.isModified("participants") || !this.participants?.length) return;

  const operations = this.participants.map((participant) => ({
    updateOne: {
      filter: { contestId: this._id, userId: participant.userId },
      update: {
        $set: {
          username: participant.username || "",
          displayName: participant.displayName || "",
          solvedSlugs: participant.solvedSlugs || [],
          score: participant.score ?? 0,
          rank: participant.rank ?? null,
          joinedAt: participant.joinedAt || new Date(),
        },
        $setOnInsert: {
          contestId: this._id,
          userId: participant.userId,
        },
      },
      upsert: true,
    },
  }));

  await ContestParticipant.bulkWrite(operations, { ordered: false });
  this.participants = [];
});

export default mongoose.model("Contest", contestSchema);
