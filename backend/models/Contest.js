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

  // Legacy compatibility during the ContestParticipant migration. New
  // participant writes are redirected to the separate collection by the
  // save hook below, and the backfill script removes this field from old
  // contest documents once their rows have been copied.
  participants: [contestParticipantFields],
}, { timestamps: true });

contestSchema.index({ status: 1, startsAt: 1 });

function idsEqual(a, b) {
  return a?.toString() === b?.toString();
}

async function hydrateParticipants(docs) {
  const items = Array.isArray(docs) ? docs : [docs];
  const valid = items.filter(Boolean);
  if (!valid.length) return;

  const contestIds = valid.map((doc) => doc._id).filter(Boolean);
  const rows = await ContestParticipant.find({ contestId: { $in: contestIds } })
    .sort({ joinedAt: 1, _id: 1 })
    .lean();

  const grouped = new Map();
  for (const row of rows) {
    const key = row.contestId.toString();
    const list = grouped.get(key) || [];
    list.push(row);
    grouped.set(key, list);
  }

  for (const doc of valid) {
    const key = doc._id.toString();
    const migrated = grouped.get(key);
    if (migrated?.length) {
      doc.participants = migrated.map(({ contestId, _id, __v, createdAt, updatedAt, ...participant }) => participant);
    } else if (doc.participants == null) {
      doc.participants = [];
    }
  }
}

// The existing contest routes still consume `contest.participants` for their
// response shape and guardrails. Hydrate that shape from the scalable store
// in one batched query per Contest.find/findOne call. Once migration is
// complete, the embedded array is no longer read from MongoDB at all.
contestSchema.post("find", async function(docs) {
  await hydrateParticipants(docs);
});

contestSchema.post("findOne", async function(doc) {
  await hydrateParticipants(doc);
});

// The old routes mutate a participant by pushing into participants[] and
// calling save(). Redirect that write to ContestParticipant before MongoDB
// persists the parent document. The parent array is cleared so new joins do
// not recreate the unbounded embedded document.
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

// The profile/history route historically filtered Contest by
// `participants.userId`. Rewrite that specific filter to the scalable
// participation collection before MongoDB executes it, preserving the
// route's public API without keeping a growing participant array on Contest.
contestSchema.pre("find", async function() {
  const filter = this.getFilter();
  const participantUserId = filter["participants.userId"];
  if (!participantUserId || filter._id) return;

  const rows = await ContestParticipant.find({ userId: participantUserId })
    .select("contestId")
    .lean();
  const contestIds = rows.map((row) => row.contestId);
  delete filter["participants.userId"];
  filter._id = { $in: contestIds };
  this.setQuery(filter);
});

export default mongoose.model("Contest", contestSchema);
