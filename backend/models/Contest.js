import mongoose from "mongoose";
import ContestParticipant from "./ContestParticipant.js";

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

}, { timestamps: true });

contestSchema.index({ status: 1, startsAt: 1 });

export default mongoose.model("Contest", contestSchema);
