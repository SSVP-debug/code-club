/**
 * collegeController.js — admin console college-management endpoints
 * (plan 005). Split out from adminController.js, which had grown to 876
 * lines by this point — larger than any other controller in the codebase
 * (judgeController.js, the next largest, is 588 lines and wasn't split).
 * This holds only the NEW function this plan adds (getColleges); the
 * existing college-related admin functions (approveTpo/rejectTpo/
 * approveStudentCollege/rejectStudentCollege) stay in adminController.js —
 * moving already-shipped, already-tested code wasn't asked for and adds
 * risk without benefit. If those ever move here too, do it as its own
 * deliberate change, not a side effect of this one.
 */
import College from "../models/College.js";
import User from "../models/User.js";
import { logger } from "../config/logger.js";
import { recordAdminAction } from "../services/adminAuditLog.js";
import { looksLikeEmailAddress } from "../utils/collegeNameHeuristics.js";
import { sanitizeRolePatternRules } from "../services/tpoRoleSignalService.js";

// ── GET /api/admin/colleges ──────────────────────────────────────────────────
// Lists every college (not just pending ones — that's getPendingQueue's job)
// with per-college aggregate stats. A Promise.all of simple counts per
// college, not a $lookup aggregation pipeline — deliberately, per plan 005's
// maintenance note: fine for "zero real users yet" and a handful of
// colleges, but doesn't scale past a few hundred. Revisit as a proper
// aggregation pipeline if the college count grows substantially.
export async function getColleges(req, res) {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status && ["pending", "verified", "rejected"].includes(status)) {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { domains: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, parseInt(limit));

    const [colleges, total] = await Promise.all([
      College.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      College.countDocuments(filter),
    ]);

    const withStats = await Promise.all(
      colleges.map(async (college) => {
        // Two distinct linkage mechanisms, per plan 005's context — a
        // query that only checks one undercounts:
        //   - students:  education.collegeId (ObjectId) — only set when the
        //     domain required manual/TPO-driven review; auto-verified-domain
        //     students are never linked to any College doc at all (see
        //     User.js's education.collegeId comment), so this is a lower
        //     bound on "how many students attend this institution," not an
        //     exhaustive count. Documented here and surfaced in the API
        //     response (see `studentCountCaveat` below) rather than silently
        //     presented as exact.
        //   - TPOs: tpoProfile.collegeDomain (domain string) against this
        //     college's domains array.
        const [studentCount, activeStudentCount, tpoCount, solvedAgg] = await Promise.all([
          User.countDocuments({ "education.collegeId": college._id, role: "student" }),
          User.countDocuments({ "education.collegeId": college._id, role: "student", status: "active" }),
          User.countDocuments({ "tpoProfile.collegeDomain": { $in: college.domains } }),
          // solvedSlugs is the live array of solved problems — its length
          // IS the accurate per-user solved count. profileSignature.solvedCount
          // was considered instead (it's already a Number field, cheaper to
          // sum) but rejected: it's an anti-tamper signing snapshot ("proves
          // data wasn't tampered", User.js's profileSignature comment), not
          // guaranteed to be live-synced with actual solves, so summing it
          // would understate active students' real totals. $size inside the
          // aggregation avoids transferring each student's full solvedSlugs
          // array over the wire — only the computed size per document.
          User.aggregate([
            { $match: { "education.collegeId": college._id, role: "student" } },
            { $group: { _id: null, total: { $sum: { $size: { $ifNull: ["$solvedSlugs", []] } } } } },
          ]),
        ]);

        return {
          id: college._id,
          name: college.name,
          staffEmailPatterns: college.staffEmailPatterns || [],
          studentEmailPatterns: college.studentEmailPatterns || [],
          domains: college.domains,
          website: college.website,
          status: college.status,
          autoDetected: college.submittedByRole === "auto",
          studentCount,
          studentCountCaveat:
            "Lower bound — students verified via an auto-recognized domain aren't linked to a specific college record.",
          activeStudentCount,
          tpoCount,
          totalSolvedProblems: solvedAgg[0]?.total || 0,
          // Recruiters are company-scoped (recruiterProfile.companyDomain),
          // not college-scoped — there's no real relationship to count here.
          // Explicitly present as null + a note, not a silently-omitted key
          // or a misleading 0 (0 would read as "no recruiter activity",
          // which isn't a claim this data model can back up either way).
          recruiterCount: null,
          recruiterCountNote: "Recruiters aren't linked to colleges in this data model — they belong to companies.",
          createdAt: college.createdAt,
        };
      })
    );

    return res.json({
      colleges: withStats,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    logger.error({ err }, "[Admin] colleges list error");
    return res.status(500).json({ error: "Failed to load colleges." });
  }
}

// ── PATCH /api/admin/colleges/:collegeId ────────────────────────────────────
// Renames a College record — primarily for correcting an auto-detected
// guess (services/collegeAutoProvision.js's deriveCollegeNameFromDomain
// output, e.g. "NITS" for a domain the admin knows is actually "National
// Institute of Technology Silchar") or fixing a garbage name that slipped
// through before the email-shaped-name guard existed (routes/tpo.js,
// routes/collegeVerification.js). Deliberately narrow: only `name` (and
// optionally `website`) are editable here — `domains`/`status` have their
// own dedicated, more consequential flows (approve/reject) and aren't
// touched by this endpoint.
export async function renameCollege(req, res) {
  try {
    const { collegeId } = req.params;
    const { name, website } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: "A college name is required." });
    }
    if (looksLikeEmailAddress(name)) {
      return res.status(400).json({
        error: "That looks like an email address — please enter the institution's name instead.",
      });
    }

    const college = await College.findById(collegeId);
    if (!college) {
      return res.status(404).json({ error: "College not found." });
    }

    const previousName = college.name;
    college.name = name.trim();
    if (website !== undefined) {
      college.website = website?.trim() || null;
    }
    await college.save();

    recordAdminAction({
      adminDoc: req.actingAdminDoc || req.userDoc,
      action: "college.rename",
      targetType: "College",
      targetId: college._id,
      details: { from: previousName, to: college.name },
    });

    return res.json({
      success: true,
      college: { id: college._id, name: college.name, website: college.website },
    });
  } catch (err) {
    logger.error({ err }, "[Admin] rename college error");
    return res.status(500).json({ error: "Failed to rename college." });
  }
}

/**
 * PATCH /api/admin/colleges/:collegeId/email-role-patterns
 *
 * College-specific email patterns are advisory evidence only. They help
 * classify an authenticated institutional email as staff_candidate,
 * student_candidate, ambiguous, or unknown; they never grant TPO access.
 */
export async function updateEmailRolePatterns(req, res) {
  try {
    const { collegeId } = req.params;
    const { staffEmailPatterns, studentEmailPatterns } = req.body || {};

    if (!Array.isArray(staffEmailPatterns) || !Array.isArray(studentEmailPatterns)) {
      return res.status(400).json({
        error: "staffEmailPatterns and studentEmailPatterns must both be arrays.",
      });
    }

    const staff = sanitizeRolePatternRules(staffEmailPatterns);
    const students = sanitizeRolePatternRules(studentEmailPatterns);

    const college = await College.findById(collegeId);
    if (!college) return res.status(404).json({ error: "College not found." });

    college.staffEmailPatterns = staff;
    college.studentEmailPatterns = students;
    await college.save();

    recordAdminAction({
      adminDoc: req.actingAdminDoc || req.userDoc,
      action: "college.email_role_patterns.update",
      targetType: "College",
      targetId: college._id,
      details: {
        staffRuleCount: staff.length,
        studentRuleCount: students.length,
      },
    });

    return res.json({
      success: true,
      college: {
        id: college._id,
        name: college.name,
        domains: college.domains,
        staffEmailPatterns: college.staffEmailPatterns,
        studentEmailPatterns: college.studentEmailPatterns,
      },
    });
  } catch (err) {
    logger.error({ err }, "[Admin] update college email-role patterns error");
    return res.status(500).json({ error: "Failed to update college email-role patterns." });
  }
}
