import mongoose from "mongoose";

/**
 * CohortMembership — the persistent relationship between a Cohort and a
 * student (TPO-2 Step 3).
 *
 * College → Cohort → CohortMembership → Student/User
 *
 * A separate collection, not an embedded array on Cohort and not a
 * `cohortId` on User — same reasoning the TPO-2 architecture audit gave
 * for this relationship, and the same structural shape
 * RecruiterInterest.js already uses elsewhere in this codebase (two
 * ObjectId refs + status-ish fields + timestamps, no embedding): a
 * student changing cohorts, transferring, or belonging to more than one
 * cohort at once all become "add/close a membership row," never a
 * destructive overwrite of history; archiving a Cohort never requires
 * touching every member row; and "which cohorts is this student in"
 * doesn't require a reverse scan of every Cohort's embedded array.
 *
 * `studentId` is nullable on purpose — a roster row (from a future
 * import step) can exist before any matching Code Club account does.
 * This model never creates a User; matching/creating an account is
 * strictly a later service-layer concern, not something the schema
 * does or implies.
 *
 * No lifecycle logic here either: which status transitions are valid,
 * and whether the various `*At` timestamps get set together with a
 * status change, is entirely the service layer's job (a later TPO-2
 * step) — same separation Cohort.js already established for its own
 * active/archived lifecycle.
 */
const cohortMembershipSchema = new mongoose.Schema(
  {
    cohortId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cohort",
      required: true,
    },

    // Nullable — see the file header. An "invited" row with no matching
    // account yet is a normal, valid state, not an incomplete one.
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Denormalized from Cohort.collegeId, deliberately — NOT populated by
    // a schema hook (the task's explicit instruction: this schema
    // doesn't reach into Cohort to look anything up). The caller
    // (service layer, in a later step) is responsible for setting it
    // from the same Cohort document it already loaded to validate
    // cohortId in the first place. It exists purely so institution-
    // scoped membership queries (the same "never trust a client-
    // supplied collegeId, always scope to the resolved institution"
    // pattern TPO-1's hardened routes already use — see
    // services/tpoTeamService.js) don't need a join through Cohort to
    // enforce that boundary.
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "College",
      required: true,
    },

    // invited → active → removed. Deliberately no "pending" state — the
    // TPO-2 architecture audit explicitly deferred that until there's a
    // concrete accept-workflow requirement; adding it speculatively now
    // would be exactly the kind of unused workflow state the audit
    // warned against.
    status: {
      type: String,
      enum: ["invited", "active", "removed"],
      default: "invited",
    },

    // The roster row's own email — kept even after `studentId` is
    // matched, both as the (cohortId, email) duplicate-import guard's
    // basis (see the unique index below) and as an audit trail of what
    // the original import/invite actually said, independent of whatever
    // email the matched account currently has on file. Normalized the
    // same way User.js's own `email` field already is (trim + lowercase
    // via Mongoose's built-in SchemaType options, not a custom setter) —
    // "Student@College.edu", "student@college.edu", and
    // " STUDENT@COLLEGE.EDU " all resolve to the identical stored value,
    // which is what lets the unique index below actually catch
    // case/whitespace-varied duplicates. Deliberately NOT format-
    // validated here (no @ / TLD check) — malformed input is a
    // service/import-layer concern (e.g. reporting a bad CSV row), not
    // something this schema silently repairs or a reason to make
    // constructing a document itself throw.
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    invitedAt: { type: Date, default: null },
    joinedAt: { type: Date, default: null },
    removedAt: { type: Date, default: null },

    // The TPO/admin responsible for this membership existing — who ran
    // the import, or who added this row by hand. Always required: every
    // membership row is attributable to someone, even one created from
    // an import batch (importBatchId groups the rows; addedBy is still
    // the human who kicked that batch off).
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Groups rows from the same import run, for audit/rollback
    // visibility (per the TPO-2 architecture audit's roster-import
    // design). No ImportBatch model exists or is being created in this
    // step — this is a bare, unref'd ObjectId a later import step can
    // generate per run (e.g. `new mongoose.Types.ObjectId()` as a batch
    // marker) without this schema needing to know anything about what a
    // "batch" is.
    importBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ──────────────────────────────────────────────────────────────

// The database-level duplicate-import guard (per this step's explicit
// instruction: NOT application-only duplicate detection). Scoped to
// (cohortId, email) — not collegeId+email, and not a bare email index —
// because the same student/email legitimately belonging to multiple
// cohorts within one institution is a normal case (per this step's
// explicit instruction), not a duplicate. Relies on the `email` field's
// own trim+lowercase normalization above to make
// "Student@College.edu" / "student@college.edu" / " STUDENT@COLLEGE.EDU "
// collide as the same indexed value.
cohortMembershipSchema.index({ cohortId: 1, email: 1 }, { unique: true });

// Roster-view access pattern: "this cohort's members, filtered by
// status" — mirrors Cohort.js's own { collegeId, status } index shape.
cohortMembershipSchema.index({ cohortId: 1, status: 1 });

// "Which cohorts is this student in" reverse lookup. Deliberately NOT
// unique — a student may legitimately belong to multiple cohorts (this
// step's explicit instruction), including more than one at the same
// institution.
cohortMembershipSchema.index({ studentId: 1 });

// Institution-scoped safety net for any query that needs "every
// membership at this college" without going through Cohort at all —
// same denormalized-for-query-safety reasoning as the collegeId field
// itself.
cohortMembershipSchema.index({ collegeId: 1 });

const CohortMembership = mongoose.model("CohortMembership", cohortMembershipSchema);
export default CohortMembership;