import mongoose from "mongoose";
import { SUPPORTED_LANGUAGE_KEYS } from "../config/languages.js";

// Status values must exactly match what backend/routes/judge.js returns.
// The emoji suffixes are intentional — they are displayed directly in the UI.
export const SUBMISSION_STATUSES = [
  "Accepted",
  "Wrong Answer",
  "Compilation Error",
  "Runtime Error",
  "Time Limit Exceeded",
  "Judge Error",
];

const submissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    problemSlug: {
      type: String,
      required: true,
      trim: true,
    },
    // ── Contest linkage (Fest Readiness Audit, P0-1) ───────────────────────
    // Optional — null/absent for ordinary practice submissions, which are
    // the overwhelming majority and must keep working exactly as before.
    // Set only when this submission was made with a contest context (see
    // controllers/judgeController.js submitHandler and
    // services/contestScoring.js). This is what makes contest scoring
    // verifiable server-side instead of trusting a bare client claim: see
    // docs/security-fixes/Solve-integrity.md for the identical reasoning
    // already applied to XP/progress, which this extends to contests.
    contestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contest",
      default: null,
    },
    // ── Battle Room linkage ─────────────────────────────────────────────────
    // Optional — null/absent for ordinary practice and contest submissions,
    // which stay the overwhelming majority. Set only when this submission
    // was made with a Battle Room context (see
    // controllers/judgeController.js submitHandler and
    // services/battleRoomScoring.js). Same reasoning as contestId above:
    // this is what makes Battle Room scoring verifiable server-side —
    // a real Judge0-graded Submission row, not a bare client claim of
    // "solved" — instead of the client-trusting model the original
    // BattleRoom /:id/solve endpoint used.
    battleRoomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BattleRoom",
      default: null,
    },
    statusDescription: {
      type: String,
    },
    judge0Time: {
      type: String,
    },
    memory: {
      type: Number,
      default: 0,
      min: 0,
    },
    problemTitle: String,
    // Minimum-viable versioning follow-up (see Problem.js's
    // `contentVersion` field comment for the full reasoning). Captured
    // from `problem.contentVersion` at the moment this submission was
    // judged (see controllers/judgeController.js's `finish()`) — a
    // snapshot, not a live reference, so it never changes after the
    // fact. `null`/absent for every submission recorded before this
    // field existed; treat that the same as "unknown," not "version 0."
    // Lets a later reader notice "this submission's verdict was computed
    // under a grading contract that has since changed" without needing to
    // store or reconstruct the actual old testcases/contract.
    problemVersion: {
      type: Number,
      default: null,
    },
    // Content & Execution Architecture, Phase 2: sourced from
    // SUPPORTED_LANGUAGE_KEYS (config/languages.js) — deliberately the
    // full REGISTERED set, not ENABLED_LANGUAGE_KEYS. A language being
    // disabled must never make historical Submission documents written in
    // that language fail to validate/read — this enum only needs to
    // shrink if a language is removed from the registry entirely (which
    // has never happened and isn't part of this phase), not when it's
    // merely toggled off. See config/languages.js's own module comment.
    language: {
      type: String,
      enum: SUPPORTED_LANGUAGE_KEYS,
      required: true,
    },
    // Status must match judge route output — includes emoji suffix
    status: {
      type: String,
      enum: SUBMISSION_STATUSES,
      required: true,
    },
    passed: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      default: 0,
      min: 0,
    },
    visiblePassed: {
      type: Number,
      default: 0,
      min: 0,
    },
    hiddenPassed: {
      type: Number,
      default: 0,
      min: 0,
    },
    executionTime: String,
    expectedOutput: mongoose.Schema.Types.Mixed,
    actualOutput: String,
    // Raw code stored for submission history diffs. Cleared (set to "")
    // after SUBMISSION_CODE_RETENTION_DAYS by
    // scripts/archiveOldSubmissionCode.js — the submission document itself
    // is never deleted (status/passed/total/timestamps are kept forever,
    // since the global acceptance-rate aggregation below depends on every
    // submission ever made, not just recent ones). Frontend must handle
    // an empty code value for old submissions.
    code: {
      type: String,
      maxlength: 50_000,
      default: "",
    },
    // ── Submission Experience (encouragement engine) ──────────────────────
    // Set only for non-Accepted submissions. normalizedCodeHash lets the
    // server tell "resubmitted the exact same logic" apart from "actually
    // changed something" without storing/parsing an AST — see
    // utils/codeNormalization.js. encouragementMessage is the resolved text
    // shown to the student for THIS submission; it's persisted (not just
    // computed on the fly) so a repeat of the same normalized code always
    // reproduces the same message, and so submission history can show what
    // was said at the time. See utils/encouragementMessages.js.
    normalizedCodeHash: {
      type: String,
      default: null,
    },
    encouragementMessage: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────────────────────────
// Compound index: covers listSubmissions (userId + createdAt) — the primary query
submissionSchema.index({ userId: 1, createdAt: -1 });

// Cursor pagination adds `_id` as a deterministic tie-breaker when two
// submissions share the same millisecond timestamp. This keeps page boundaries
// stable without using skip/offset as history grows.
submissionSchema.index({ userId: 1, createdAt: -1, _id: -1 });

// Compound index: covers per-problem submission filter (userId + problemSlug)
submissionSchema.index({ userId: 1, problemSlug: 1 });

// Index: covers insights query filtering by status
submissionSchema.index({ userId: 1, status: 1 });

// Index: covers the global per-problem acceptance-rate aggregation
// (problemController.getAcceptanceRates) which groups ALL users'
// submissions by problemSlug — without this, that aggregation would
// fall back to a full collection scan as submission volume grows.
submissionSchema.index({ problemSlug: 1, status: 1 });

// Index: covers the "find my last non-accepted attempt on this problem"
// lookup in submissionController.recordVerifiedSubmission (the encouragement
// dedupe check) — sorted newest-first, scoped per user+problem.
submissionSchema.index({ userId: 1, problemSlug: 1, createdAt: -1 });

// Index: covers the contest-solve proof lookup (P0-1) — "does this user
// have a server-verified Accepted submission for this problem, in this
// contest?" — used by the legacy POST /api/contests/:id/solve compat path.
// Sparse: the overwhelming majority of submissions have no contestId at
// all, so a sparse index keeps this cheap rather than indexing every
// practice-mode row under a null key.
submissionSchema.index(
  { contestId: 1, userId: 1, problemSlug: 1, status: 1 },
  { sparse: true }
);

// Index: covers the Battle Room-solve proof lookup — "does this user have
// a server-verified Accepted submission for this problem, in this Battle
// Room?" — used by services/battleRoomScoring.js. Sparse for the same
// reason as the contestId index above: almost no submissions carry a
// battleRoomId.
submissionSchema.index(
  { battleRoomId: 1, userId: 1, problemSlug: 1, status: 1 },
  { sparse: true }
);

const Submission = mongoose.model("Submission", submissionSchema);

export default Submission;
