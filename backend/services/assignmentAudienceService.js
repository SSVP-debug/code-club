import User from "../models/User.js";
import College from "../models/College.js";
import CohortMembership from "../models/CohortMembership.js";

/**
 * Resolves the audience of students who are targets of a given assignment,
 * given only the assignment document itself — no req/TPO context required.
 *
 * This exists for scripts/sendAssignmentAutoReminders.js, which sweeps
 * assignments across every college in one pass and so has no single
 * "current TPO" to resolve a college from the way routes/tpo.js's
 * request-scoped resolveAssignmentAudience() does. The two are kept as
 * separate functions rather than unified into one, so that this refactor
 * carries zero risk to the already-tested /remind and /completion routes.
 *
 * Same audience rule as everywhere else in the assignment feature:
 *   - cohort-scoped assignment (cohortId set): active cohort members only.
 *   - legacy/college-wide assignment: every student on any domain the
 *     owning College spans (multi-domain colleges share one roster),
 *     falling back to the assignment's own collegeDomain for assignments
 *     that predate the College/collegeId migration.
 *
 * Deliberately does NOT filter by visibleToTpo — assignment delivery is
 * membership-driven, not gated by the TPO-3 dashboard/directory opt-out.
 * See the identical note on GET /api/assignments/student and on
 * routes/tpo.js's resolveAssignmentAudience().
 */
export async function getAssignmentAudience(assignment, selectFields = "_id solvedSlugs") {
  if (assignment.cohortId) {
    const studentIds = await CohortMembership.find({
      cohortId: assignment.cohortId,
      status: "active",
      studentId: { $ne: null },
    }).distinct("studentId");

    return User.find({ _id: { $in: studentIds }, role: "student" })
      .select(selectFields)
      .lean();
  }

  let audienceDomains = [];
  if (assignment.collegeId) {
    const college = await College.findById(assignment.collegeId).select("domains").lean();
    audienceDomains = college?.domains?.length
      ? college.domains.map((d) => d.toLowerCase())
      : assignment.collegeDomain
        ? [assignment.collegeDomain.toLowerCase()]
        : [];
  } else if (assignment.collegeDomain) {
    audienceDomains = [assignment.collegeDomain.toLowerCase()];
  }

  if (!audienceDomains.length) return [];

  return User.find({ emailDomain: { $in: audienceDomains }, role: "student" })
    .select(selectFields)
    .lean();
}
