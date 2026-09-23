import mongoose from "mongoose";

/**
 * Assignment — a TPO assigns a set of problems to students at their
 * institution, with a due date.
 *
 * TPO-4 adds optional cohort targeting. Existing assignments keep
 * cohortId: null and therefore remain college-wide; new cohort-scoped
 * assignments point at one institution-owned Cohort. Route/service code
 * is responsible for proving that the cohort belongs to the same College
 * before writing or reading it.
 *
 * collegeId is the canonical institution boundary. collegeDomain remains
 * for backward compatibility while existing assignments are migrated.
 */
const assignmentSchema = new mongoose.Schema(
  {
    tpoId:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "College",
      default: null,
      index: true,
    },
    collegeDomain:{ type: String, required: true, index: true },
    cohortId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cohort",
      default: null,
      index: true,
    },
    title:        { type: String, required: true, trim: true },
    problemSlugs: [{ type: String, required: true }],
    dueDate:      { type: Date, required: true },
    createdAt:    { type: Date, default: Date.now },
  },
  { timestamps: true }
);

assignmentSchema.index({ collegeDomain: 1, dueDate: -1 });
assignmentSchema.index({ collegeId: 1, dueDate: -1 });
assignmentSchema.index({ cohortId: 1, dueDate: -1 });

const Assignment = mongoose.model("Assignment", assignmentSchema);
export default Assignment;
