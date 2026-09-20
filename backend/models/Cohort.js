import mongoose from "mongoose";

/**
 * Cohort — an institution-managed student group (TPO-2).
 *
 * A Cohort is a TPO's own organizational unit for a batch of students —
 * e.g. "CSE 2027" (B.Tech CSE, graduating 2028, admitted for the
 * 2024–2025 academic year, optionally split into sections). It belongs
 * to exactly one College (`collegeId`) — that's the institutional
 * ownership boundary every cohort route/service in later TPO-2 steps
 * must scope every read and write through, the same way TPO-1's
 * hardened team routes scope through `college.domains` (see
 * services/tpoTeamService.js).
 *
 * This model is deliberately just the group's own identity/metadata.
 * Which students belong to it is a separate concern — CohortMembership
 * (TPO-2 Step 3, not created yet) — kept as its own collection rather
 * than an embedded array here, for the same reasons the TPO-2
 * architecture audit gave for College ↔ TPO membership: history across
 * a student changing cohorts, cheap archiving without touching member
 * rows, and a student legitimately belonging to more than one cohort
 * over time.
 *
 * No authorization logic lives here on purpose — whether a given TPO
 * may create, edit, or archive a cohort is a route/service-layer
 * decision (TPO-2 Step 4+), not a schema concern. This mirrors
 * tpoTeamService.js's own separation: the model/CAS layer knows nothing
 * about who's "allowed" to call it, only how to keep its own invariants
 * consistent.
 */
const cohortSchema = new mongoose.Schema(
  {
    // ── Institutional ownership ──────────────────────────────────────────
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "College",
      required: true,
      index: true,
    },

    // ── Identity ──────────────────────────────────────────────────────────
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    // e.g. "2024-2025" — the academic year this cohort is currently in.
    // Free text (not a Date/enum): institutions phrase this inconsistently
    // ("2024-25", "2024–2025", single-year systems, etc.) and normalizing
    // it isn't a stated TPO-2 requirement.
    academicYear: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },

    // e.g. 2027 — the year this cohort graduates. A plain four(ish)-digit
    // year, deliberately NOT bounded to a narrow "current year ± N" range
    // (that would silently start rejecting valid cohorts as time passes —
    // see this field's validator comment below). Institutions plan
    // multiple years ahead and behind "now."
    graduatingYear: {
      type: Number,
      required: true,
      validate: {
        validator: (v) => Number.isInteger(v) && v >= 1900 && v <= 2999,
        message: "graduatingYear must be a four-digit year.",
      },
    },

    // Free text for now — Cohort does NOT reference a Branch collection
    // or any institution-managed branch list (explicitly out of scope
    // for this step; see this file's header and the TPO-2 architecture
    // audit's "Branch and graduating-year management" question, left
    // open there on purpose).
    branch: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    // Optional. A blank/whitespace-only value is normalized to null at
    // the setter (cast-time) — "no section given" is what an empty
    // submission means here, not a validation error; this keeps the
    // field genuinely optional end to end rather than letting a stray
    // "" sit in the database as if it were a real, if meaningless, value.
    section: {
      type: String,
      default: null,
      trim: true,
      maxlength: 60,
      set: (v) => {
        if (v === null || v === undefined) return null;
        const trimmed = String(v).trim();
        return trimmed.length > 0 ? trimmed : null;
      },
    },

    // The TPO's own estimate of how many students this cohort should
    // eventually have — not derived from CohortMembership (which doesn't
    // exist yet in this step), just a plain optional number they can
    // set and edit themselves.
    expectedHeadcount: {
      type: Number,
      default: null,
      validate: {
        validator: (v) => v === null || v === undefined || (Number.isInteger(v) && v >= 0),
        message: "expectedHeadcount must be a non-negative integer.",
      },
    },

    // ── Lifecycle ───────────────────────────────────────────────────────
    // Created → Active → Archived (per the TPO-2 architecture audit's
    // "Cohort lifecycle" section) — "active" is the only meaningful
    // starting state; there's no separate "created but not yet active"
    // state to model.
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      index: true,
    },

    archivedAt: {
      type: Date,
      default: null,
    },

    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ── Provenance ────────────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Primary access patterns this step's audit named explicitly: "this
// college's cohorts, filtered by lifecycle state" and "this college's
// cohorts for a given graduating year." Both are compound with
// collegeId first since every cohort query is institution-scoped first
// and foremost (never a bare cross-institution scan) — the same
// leading-field-is-the-tenant-boundary shape as
// userSchema.index({ emailDomain: 1, role: 1 }) and
// assignmentSchema.index({ collegeDomain: 1, dueDate: -1 }).
cohortSchema.index({ collegeId: 1, status: 1 });
cohortSchema.index({ collegeId: 1, graduatingYear: 1 });

// Deliberately NOT enforcing { collegeId, name } uniqueness. Nothing in
// the stated TPO-2 requirements says cohort names must be unique within
// an institution, and real institutional naming isn't guaranteed
// collision-free in a way a hard constraint should police: a TPO
// managing "Section A" cohorts for two different branches, or two
// different graduating years, could legitimately reuse the same short
// name. A uniqueness constraint here would block that legitimate case
// to guard against a typo'd duplicate that's better handled at the
// service/UI layer (e.g. a "you already have a cohort named X — create
// anyway?" confirmation) in a later step, not enforced destructively at
// the schema level now.
const Cohort = mongoose.model("Cohort", cohortSchema);
export default Cohort;