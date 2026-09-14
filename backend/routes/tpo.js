import { Router } from "express";
import { logger } from "../config/logger.js";
import User from "../models/User.js";
import { B2B_ENABLED } from "../config/featureFlags.js";
import Assignment from "../models/Assignment.js";
import { createRequire } from "module";
import { requireRole } from "../middleware/roleGuard.js";
import College from "../models/College.js";
import { SITE_URL, SUPPORT_EMAIL } from "../config/site.js";
import { requireVerified } from "../middleware/requireVerified.js";
import { getOrSetCache } from "../utils/cache.js";
import { invalidateTpoCache } from "../controllers/tpoController.js";
import { createNotificationBulk } from "../services/notificationService.js";
import { isDomainAutoVerified, isConsumerEmailDomain } from "../utils/domainVerification.js";
import { looksLikeEmailAddress } from "../utils/collegeNameHeuristics.js";
import { getSettings } from "../services/settingsService.js";

const TPO_CACHE_TTL_SECONDS = 2 * 60; // 2 minutes — matches profile cache TTL
const TPO_CACHE_PREFIX = "tpo:";

const require = createRequire(import.meta.url);


const router = Router();

// Full-college scans (/students, /dashboard) are the most expensive queries
// in this file — every request re-reads every student row for the domain.
// Cached per-domain via the shared Redis-backed helper so multiple Railway
// instances agree, same pattern as leaderboard.js.


function b2bGate(req, res) {
  if (!B2B_ENABLED) {
    res.status(200).json({
      enabled: false,
      message: `College dashboard is not live yet. Reach out to ${SUPPORT_EMAIL} for early access.`,
    });
    return true;
  }
  return false;
}

// Plan 009: gates NEW TPO registrations only — never blocks an existing
// TPO from logging in or using any other /api/tpo route (b2bGate above
// already runs first anyway; this only ever runs inside /register).
// Exported for direct unit testing, same pattern as this file's own
// handleRemindAssignment.
export async function tpoRegistrationGate(req, res) {
  const settings = await getSettings();
  if (settings.tpoRegistrationEnabled === false) {
    res.status(403).json({
      error: "TPO registration is temporarily disabled. Please check back later.",
    });
    return true;
  }
  return false;
}

// ── POST /api/tpo/register ──────────────────────────────────────────────────
// A regular user converts their account into a TPO account.
// In practice: a separate signup page asks for college name + verifies the
// email domain matches an institutional domain (not gmail.com etc).
router.post("/register", async (req, res) => {
  if (b2bGate(req, res)) return;
  if (await tpoRegistrationGate(req, res)) return;

  try {
    const { collegeName } = req.body;
    if (!req.userDoc) return res.status(503).json({ error: "Database unavailable." });
    if (!collegeName) return res.status(400).json({ error: "collegeName is required." });

    if (looksLikeEmailAddress(collegeName)) {
      // The "unnecessary box" bug class: a College record whose name is
      // literally someone's email address, pasted into the wrong field.
      // Reject it here instead of silently storing it.
      return res.status(400).json({
        error: "That looks like an email address — please enter your college's name instead.",
      });
    }

    const email = req.userDoc.email || "";
    const domain = email.split("@")[1];

    if (!domain || isConsumerEmailDomain(domain)) {
      return res.status(400).json({
        error: "Please sign up with your institutional email (e.g. yourname@college.ac.in), not a personal email.",
      });
    }

    // A second TPO from a domain that's already verified doesn't need
    // another manual review — the college itself has already been vetted.
    // A domain still pending review from an earlier TPO or student stays
    // blocked from a second claim, to avoid two conflicting requests in
    // the queue — UNLESS the existing record is an auto-detected
    // placeholder (submittedByRole: "auto", created the moment some
    // student first signed up from this domain — see
    // services/collegeAutoProvision.js). Nobody actually submitted that
    // one; it's not a real claim to conflict with, so a TPO registering
    // for the same domain should be able to claim/upgrade it rather than
    // being blocked by a guess nobody reviewed.
    const existingCollege = await College.findByDomain(domain);
    const existingIsAutoPlaceholder = existingCollege?.submittedByRole === "auto";

    if (existingCollege && existingCollege.status !== "verified" && !existingIsAutoPlaceholder) {
      return res.status(409).json({
        error: "This college is already registered and pending verification.",
        status: existingCollege.status,
      });
    }

    const now = new Date();
    // Hybrid verification (Phase B): known college domains — including one
    // already verified via an earlier TPO from the same college — skip the
    // queue. Everything else is created pending and shows up in
    // GET /api/admin/pending for manual approval.
    const autoVerified =
      (existingCollege?.status === "verified" && !existingIsAutoPlaceholder) ||
      (await isDomainAutoVerified(domain, "college"));

    if (!existingCollege) {
      await College.create({
        domains: [domain],
        name: collegeName,
        status: autoVerified ? "verified" : "pending",
        verifiedAt: autoVerified ? now : null,
        submittedBy: req.userDoc._id,
        submittedByRole: "tpo",
      });
    } else if (existingIsAutoPlaceholder) {
      // Upgrade the auto-detected placeholder into a real TPO submission
      // — replace the guessed name with the TPO's actual college name and
      // record who's now vouching for it, rather than leaving a second,
      // duplicate College doc for the same domain.
      existingCollege.name = collegeName;
      existingCollege.status = autoVerified ? "verified" : "pending";
      existingCollege.verifiedAt = autoVerified ? now : null;
      existingCollege.submittedBy = req.userDoc._id;
      existingCollege.submittedByRole = "tpo";
      await existingCollege.save();
    }

    // Mark user as TPO. Previously this dropped collegeDomain/collegeName
    // entirely — tpoProfile only ever got verificationStatus (not even a
    // real schema field) + verified + requestedAt, so every TPO's own
    // college identity was silently lost. Fixed here.
    //
    // grantRole is additive — a Student registering as TPO keeps their
    // "student" authorization (and every student-track field: totalXP,
    // solvedSlugs, streaks, etc. all stay untouched on this same
    // document); only the ACTIVE role below switches to "tpo". See
    // models/User.js's role/roles comment for why student data isn't
    // moved or cleared here.
    req.userDoc.grantRole("tpo");
    req.userDoc.role = "tpo";
    req.userDoc.tpoProfile = {
      collegeDomain: domain,
      collegeName,
      verified: autoVerified,
      requestedAt: now,
      verifiedAt: autoVerified ? now : null,
    };

    await req.userDoc.save();

    return res.status(201).json({
      success: true,
      role: "tpo",
      verified: autoVerified,
      status: autoVerified ? "verified" : "pending",
      message: autoVerified
        ? "Your college is verified. You're all set — head to your dashboard."
        : "Your college registration request has been submitted for verification.",
    });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] register error");
    return res.status(500).json({ error: "Failed to register as TPO." });
  }
});

// ── GET /api/tpo/me ──────────────────────────────────────────────────────────
router.get("/me", requireRole("tpo", "admin"),
  requireVerified, async (req, res) => {
    if (b2bGate(req, res)) return;



    return res.json({
      collegeName: req.userDoc.tpoProfile?.collegeName,
      collegeDomain: req.userDoc.tpoProfile?.collegeDomain,
      email: req.userDoc.email,
    });
  });

// ── GET /api/tpo/students ───────────────────────────────────────────────────
// Server-side paginated/searched/sorted student directory. Previously this
// returned the ENTIRE college roster in one response and TpoDashboardPage.jsx
// filtered/sorted the full array in the browser — fine at a handful of
// students, not at the thousands a real college has. Rewritten to mirror
// the same pattern recruiter.js's /candidates endpoint already established
// for this exact "search+sort+paginate a User collection" shape: a single
// Mongo aggregation with $facet (one round-trip for both the page of data
// and the total count), rather than pulling the whole collection into Node.
const STUDENT_SORT_FIELDS = {
  // Client sort key → { Mongo sort spec }. Explicit allowlist — req.query.sort
  // is never passed into .sort()/$sort directly, so a client can't inject an
  // arbitrary field or operator here. _id is always the tiebreaker so paging
  // stays stable even when many students share the same primary sort value
  // (e.g. many students with 0 XP) — without it, students could
  // duplicate/skip across page boundaries as ties get ordered inconsistently
  // between requests.
  xp: { totalXP: -1, _id: 1 },
  solved: { solvedCount: -1, _id: 1 },
  streak: { currentStreak: -1, _id: 1 },
  name: { displayName: 1, _id: 1 },
};
const STUDENTS_DEFAULT_PAGE_SIZE = 25;
const STUDENTS_MAX_PAGE_SIZE = 50; // same cap as recruiter.js's /candidates

router.get("/students", requireRole("tpo", "admin"),
  requireVerified, async (req, res) => {
    if (b2bGate(req, res)) return;

    try {

      const domain = req.userDoc.tpoProfile?.collegeDomain;
      if (!domain) return res.status(400).json({ error: "No college domain set on this TPO account." });

      // Normalize page/limit — never trust these as-is. Invalid, missing,
      // zero, or negative values all fall back to sane defaults rather
      // than erroring or producing an inconsistent edge case, since a
      // malformed query param here shouldn't break the page for a TPO.
      const rawPage = parseInt(req.query.page, 10);
      const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
      const rawLimit = parseInt(req.query.limit, 10);
      const limit = Math.min(
        STUDENTS_MAX_PAGE_SIZE,
        Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : STUDENTS_DEFAULT_PAGE_SIZE
      );
      const skip = (page - 1) * limit;

      // Sort: explicit allowlist only — see STUDENT_SORT_FIELDS above.
      const sortKey = STUDENT_SORT_FIELDS[req.query.sort] ? req.query.sort : "xp";
      const sortSpec = STUDENT_SORT_FIELDS[sortKey];

      // Search: college-scoped like everything else here — the $match
      // below already restricts to this TPO's own emailDomain before any
      // search term is applied, so `q` can never widen the result set
      // outside the TPO's own institution. Same regex-escaping approach as
      // recruiter.js's `college` filter, so a search term containing regex
      // metacharacters (e.g. "a.b" or "(test)") is treated literally
      // instead of as a pattern.
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const searchMatch = q
        ? {
          $or: [
            { displayName: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
            { email: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
          ],
        }
        : {};

      const cacheKey = `${TPO_CACHE_PREFIX}students:${domain}:${JSON.stringify({ page, limit, sortKey, q })}`;

      const { value: payload, cacheStatus } = await getOrSetCache(
        cacheKey,
        TPO_CACHE_TTL_SECONDS,
        async () => {
          const [aggResult] = await User.aggregate([
            { $match: { emailDomain: domain.toLowerCase(), role: "student", ...searchMatch } },
            // solvedCount computed here, once, in Mongo — the raw
            // `solvedSlugs` array itself is never selected/projected out
            // below, so it never crosses into Node for this endpoint.
            { $addFields: { solvedCount: { $size: { $ifNull: ["$solvedSlugs", []] } } } },
            { $sort: sortSpec },
            {
              $facet: {
                data: [
                  { $skip: skip },
                  { $limit: limit },
                  {
                    $project: {
                      _id: 0,
                      name: "$displayName",
                      email: 1,
                      totalXP: { $ifNull: ["$totalXP", 0] },
                      solvedCount: 1,
                      currentStreak: { $ifNull: ["$currentStreak", 0] },
                      easy: { $ifNull: ["$solvedDifficulty.easy", 0] },
                      medium: { $ifNull: ["$solvedDifficulty.medium", 0] },
                      hard: { $ifNull: ["$solvedDifficulty.hard", 0] },
                      joinedDate: 1,
                    },
                  },
                ],
                totalCount: [{ $count: "count" }],
              },
            },
          ]);

          return {
            students: aggResult?.data ?? [],
            total: aggResult?.totalCount?.[0]?.count ?? 0,
          };
        }
      );

      res.set("X-Cache", cacheStatus);
      return res.json({
        college: req.userDoc.tpoProfile?.collegeName,
        domain,
        students: payload.students,
        total: payload.total,
        page,
        limit,
      });

    } catch (err) {
      (req.log || logger).error({ err }, "[TPO] students error");
      return res.status(500).json({ error: "Failed to load students." });
    }
  });


// ── GET /api/tpo/dashboard ──────────────────────────────────────────────────
// Returns aggregated class-wide stats for the TPO dashboard view.
router.get("/dashboard", requireRole("tpo", "admin"),
  requireVerified, async (req, res) => {
    if (b2bGate(req, res)) return;

    try {


      const domain = req.userDoc.tpoProfile?.collegeDomain;
      if (!domain) return res.status(400).json({ error: "No college domain set." });

      const { value: dashboard, cacheStatus } = await getOrSetCache(
        `${TPO_CACHE_PREFIX}dashboard:${domain}`,
        TPO_CACHE_TTL_SECONDS,
        async () => {
          // Two facets in one round-trip against the same $match filter:
          // "summary" sums the per-student numeric fields directly (no
          // need to pull solvedSlugs/solvedDifficulty into Node just to
          // add them up), and "topicCoverage" unwinds each student's
          // topicStats array and sums counts per topic in Mongo. Both used
          // to be a single forEach over every student document pulled
          // into Node — fine at "hundreds of students," but transferring
          // every student's full solvedSlugs/topicStats array over the
          // wire just to add up numbers doesn't hold as a college's
          // student count grows.
          const [aggResult] = await User.aggregate([
            { $match: { emailDomain: domain.toLowerCase(), role: "student" } },
            {
              $facet: {
                summary: [
                  {
                    $group: {
                      _id: null,
                      totalStudents: { $sum: 1 },
                      totalSolved: { $sum: { $size: { $ifNull: ["$solvedSlugs", []] } } },
                      totalEasy: { $sum: { $ifNull: ["$solvedDifficulty.easy", 0] } },
                      totalMedium: { $sum: { $ifNull: ["$solvedDifficulty.medium", 0] } },
                      totalHard: { $sum: { $ifNull: ["$solvedDifficulty.hard", 0] } },
                      activeThisWeek: {
                        $sum: { $cond: [{ $gt: [{ $ifNull: ["$currentStreak", 0] }, 0] }, 1, 0] },
                      },
                    },
                  },
                ],
                topicCoverage: [
                  { $unwind: "$topicStats" },
                  {
                    $group: {
                      _id: "$topicStats.topic",
                      totalSolves: { $sum: "$topicStats.count" },
                    },
                  },
                  { $sort: { totalSolves: -1 } },
                  { $limit: 10 },
                  { $project: { _id: 0, topic: "$_id", totalSolves: 1 } },
                ],
              },
            },
          ]);

          const summary = aggResult?.summary?.[0];

          if (!summary || summary.totalStudents === 0) {
            return { totalStudents: 0, message: "No students from your college have joined Code Club yet." };
          }

          const { totalStudents, totalSolved, totalEasy, totalMedium, totalHard, activeThisWeek } = summary;
          const avgSolved = Math.round((totalSolved / totalStudents) * 10) / 10;

          // ── Placement Readiness Score (0-100) ────────────────────────────────
          // Heuristic: weighted combination of average solves, hard-problem coverage,
          // and active engagement. This is the #1 number a TPO will look at.
          const solveScore = Math.min(40, (avgSolved / 100) * 40);           // up to 40 pts for solving 100+ avg
          const hardScore = Math.min(30, ((totalHard / totalStudents) / 20) * 30); // up to 30 pts for 20+ hard avg
          const engagementScore = Math.min(30, (activeThisWeek / totalStudents) * 30);  // up to 30 pts for active streaks
          const readinessScore = Math.round(solveScore + hardScore + engagementScore);

          return {
            totalStudents,
            avgSolved,
            totalSolved,
            difficultyBreakdown: { easy: totalEasy, medium: totalMedium, hard: totalHard },
            activeThisWeek,
            activePercent: Math.round((activeThisWeek / totalStudents) * 100),
            readinessScore,
            topicCoverage: aggResult?.topicCoverage ?? [],
          };
        }
      );

      res.set("X-Cache", cacheStatus);
      // college/domain come from the live req.userDoc, not the cached payload,
      // since they're cheap to read and shouldn't go stale even if the
      // aggregate numbers do for a couple minutes.
      return res.json({
        college: req.userDoc.tpoProfile?.collegeName,
        domain,
        ...dashboard,
      });

    } catch (err) {
      (req.log || logger).error({ err }, "[TPO] dashboard error");
      return res.status(500).json({ error: "Failed to load dashboard." });
    }
  });


// ── POST /api/tpo/assignments ───────────────────────────────────────────────
// TPO creates a new problem assignment for their college.
//
// requireVerified added here (2026-09) — this route was missing it while
// every other TPO route already had it (see /me, /students, /dashboard,
// /report/pdf below). Without it, a pending/unverified TPO account could
// create an assignment and trigger a mass notification to every real
// student on their claimed college domain before any admin had ever
// reviewed the account. See docs/audits/ TPO security audit.
router.post("/assignments", requireRole("tpo", "admin"), requireVerified, async (req, res) => {
  if (b2bGate(req, res)) return;

  try {


    const { title, problemSlugs, dueDate } = req.body;

    if (!title || !Array.isArray(problemSlugs) || problemSlugs.length === 0 || !dueDate) {
      return res.status(400).json({ error: "title, problemSlugs (array), and dueDate are required." });
    }

    const assignment = await Assignment.create({
      tpoId: req.userDoc._id,
      collegeDomain: req.userDoc.tpoProfile?.collegeDomain,
      title,
      problemSlugs,
      dueDate: new Date(dueDate),
    });

    // Fan out a notification to every student in the college. Fire-and-forget
    // — a notification hiccup shouldn't fail assignment creation, which has
    // already succeeded. Uses insertMany under the hood (via
    // createNotificationBulk), so this stays cheap even for a large roster.
    const domain = req.userDoc.tpoProfile?.collegeDomain;
    if (domain) {
      User.find({
        emailDomain: domain.toLowerCase(),
        role: "student",
      })
        .select("_id")
        .lean()
        .then((students) =>
          createNotificationBulk(
            students.map((s) => s._id),
            {
              type: "assignment_created",
              title: "New assignment posted",
              message: `${title} — due ${new Date(dueDate).toLocaleDateString()}`,
              link: "/problems",
              meta: { assignmentId: assignment._id },
            }
          )
        )
        .catch((err) => (req.log || logger).error({ err }, "[TPO] Assignment notification fan-out failed"));
    }

    return res.status(201).json(assignment);
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] create assignment error");
    return res.status(500).json({ error: "Failed to create assignment." });
  }
});

// ── GET /api/tpo/assignments ────────────────────────────────────────────────
// TPO view: all assignments they've created, with per-student completion %.
// requireVerified added here (2026-09) — see the POST /assignments comment
// above for why.
router.get("/assignments", requireRole("tpo", "admin"), requireVerified, async (req, res) => {
  if (b2bGate(req, res)) return;

  try {


    const assignments = await Assignment.find({
      collegeDomain: req.userDoc.tpoProfile?.collegeDomain,
    })
      .sort({ dueDate: -1 })
      .lean();

    // Compute completion % per assignment
    const domain = req.userDoc.tpoProfile?.collegeDomain;
    if (!domain) return res.status(400).json({ error: "No college domain set on this TPO account." });
    const students = await User.find({
      emailDomain: domain.toLowerCase(),
      role: "student",
    }).select("solvedSlugs").lean();

    const totalStudents = students.length || 1;

    const enriched = assignments.map(a => {
      const completedCount = students.filter(s =>
        a.problemSlugs.every(slug => (s.solvedSlugs || []).includes(slug))
      ).length;

      return {
        ...a,
        completedCount,
        totalStudents,
        completionPercent: Math.round((completedCount / totalStudents) * 100),
        isOverdue: new Date(a.dueDate) < new Date(),
      };
    });

    return res.json({ assignments: enriched });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] list assignments error");
    return res.status(500).json({ error: "Failed to load assignments." });
  }
});

// ── POST /api/tpo/assignments/:id/remind ────────────────────────────────────
// Nudges every student on this college's roster who hasn't completed the
// assignment yet. Reuses the same createNotificationBulk fan-out the
// assignment-creation flow already uses for consistency. Extracted as a
// named function (rather than inline, like handleCreateInterest in
// recruiter.js) so it can be unit-tested directly.
export async function handleRemindAssignment(req, res) {
  if (b2bGate(req, res)) return;

  try {
    const domain = req.userDoc.tpoProfile?.collegeDomain;
    if (!domain) return res.status(400).json({ error: "No college domain set on this TPO account." });

    const assignment = await Assignment.findOne({
      _id: req.params.id,
      collegeDomain: domain,
    }).lean();
    if (!assignment) return res.status(404).json({ error: "Assignment not found." });

    const students = await User.find({
      emailDomain: domain.toLowerCase(),
      role: "student",
    }).select("_id solvedSlugs").lean();

    const incomplete = students.filter(s =>
      !assignment.problemSlugs.every(slug => (s.solvedSlugs || []).includes(slug))
    );

    if (incomplete.length === 0) {
      return res.json({ remindedCount: 0, message: "Everyone has already completed this assignment." });
    }

    await createNotificationBulk(
      incomplete.map(s => s._id),
      {
        type: "assignment_reminder",
        title: "Reminder: assignment due soon",
        message: `${assignment.title} — due ${new Date(assignment.dueDate).toLocaleDateString()}. You haven't finished it yet.`,
        link: "/problems",
        meta: { assignmentId: assignment._id },
      }
    );

    return res.json({ remindedCount: incomplete.length });
  } catch (err) {
    (req.log || logger).error({ err }, "[TPO] assignment remind");
    return res.status(500).json({ error: "Failed to send reminder." });
  }
}

// requireVerified added here (2026-09) — see the POST /assignments comment
// above for why.
router.post("/assignments/:id/remind", requireRole("tpo", "admin"), requireVerified, handleRemindAssignment);

// ── GET /api/assignments/student ────────────────────────────────────────────
// Student view: assignments relevant to their college, with their own progress.
// Mounted separately (not /api/tpo/* — students aren't TPOs).
export const studentAssignmentsRouter = Router();

studentAssignmentsRouter.get("/", async (req, res) => {
  if (!B2B_ENABLED) return res.json({ enabled: false, assignments: [] });

  try {
    if (!req.userDoc?.email) return res.json({ assignments: [] });

    const domain = req.userDoc.email.split("@")[1];
    const assignments = await Assignment.find({ collegeDomain: domain })
      .sort({ dueDate: 1 })
      .lean();

    const solvedSet = new Set(req.userDoc.solvedSlugs || []);

    const enriched = assignments.map(a => {
      const solvedCount = a.problemSlugs.filter(slug => solvedSet.has(slug)).length;
      return {
        _id: a._id,
        title: a.title,
        dueDate: a.dueDate,
        problemSlugs: a.problemSlugs,
        solvedCount,
        totalProblems: a.problemSlugs.length,
        isComplete: solvedCount === a.problemSlugs.length,
        isOverdue: new Date(a.dueDate) < new Date(),
      };
    });

    return res.json({ enabled: true, assignments: enriched });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load assignments." });
  }
});


// ── GET /api/tpo/report/pdf ─────────────────────────────────────────────────
// Generates a class performance PDF — the document a TPO shows their
// placement director to justify the Code Club subscription.
router.get("/report/pdf", requireRole("tpo", "admin"),
  requireVerified, async (req, res) => {
    if (b2bGate(req, res)) return;

    let PDFDocument;
    try {
      PDFDocument = require("pdfkit");
    } catch {
      return res.status(503).json({ error: "PDF generation unavailable. Run: cd backend && npm install pdfkit" });
    }

    try {


      const domain = req.userDoc.tpoProfile?.collegeDomain;
      if (!domain) return res.status(400).json({ error: "No college domain set on this TPO account." });
      const students = await User.find({
        emailDomain: domain.toLowerCase(),
        role: "student",
      })
        .select("displayName totalXP solvedSlugs solvedDifficulty currentStreak topicStats")
        .sort({ totalXP: -1 })
        .lean();

      const totalStudents = students.length;
      const totalSolved = students.reduce((sum, s) => sum + (s.solvedSlugs?.length ?? 0), 0);
      const avgSolved = totalStudents ? Math.round((totalSolved / totalStudents) * 10) / 10 : 0;
      const activeCount = students.filter(s => (s.currentStreak ?? 0) > 0).length;

      const doc = new PDFDocument({ size: "A4", margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${(req.userDoc.tpoProfile?.collegeName || "college").replace(/[^a-z0-9]/gi, "_")}_codeclub_report.pdf"`);
      doc.pipe(res);

      // Header
      doc.rect(0, 0, doc.page.width, 90).fill("#18181b");
      doc.fontSize(22).fillColor("#22c55e").font("Helvetica-Bold").text("Code Club", 50, 24);
      doc.fontSize(11).fillColor("#a1a1aa").font("Helvetica").text("Class Performance Report", 50, 52);
      doc.fontSize(10).fillColor("#71717a")
        .text(new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), doc.page.width - 200, 52, { align: "right", width: 150 });

      doc.fontSize(18).fillColor("#000").font("Helvetica-Bold").text(req.userDoc.tpoProfile?.collegeName || "College", 50, 110);
      doc.fontSize(10).fillColor("#71717a").font("Helvetica").text(domain, 50, 134);

      // Summary stats
      let sy = 165;
      const summary = [
        { label: "Total Students", value: totalStudents },
        { label: "Avg Problems Solved", value: avgSolved },
        { label: "Active This Week", value: `${activeCount} (${totalStudents ? Math.round(activeCount / totalStudents * 100) : 0}%)` },
        { label: "Total Problems Solved", value: totalSolved },
      ];
      let sx = 50;
      summary.forEach(s => {
        doc.rect(sx, sy, 120, 50).fill("#f4f4f5");
        doc.fontSize(18).fillColor("#16a34a").font("Helvetica-Bold").text(String(s.value), sx + 10, sy + 8);
        doc.fontSize(8).fillColor("#71717a").font("Helvetica").text(s.label, sx + 10, sy + 30, { width: 100 });
        sx += 130;
      });

      // Student table
      let ty = sy + 75;
      doc.fontSize(12).fillColor("#000").font("Helvetica-Bold").text("STUDENT RANKINGS", 50, ty);
      ty += 22;

      doc.fontSize(8).fillColor("#71717a").font("Helvetica-Bold");
      doc.text("Rank", 50, ty); doc.text("Name", 90, ty); doc.text("Solved", 320, ty);
      doc.text("Streak", 380, ty); doc.text("XP", 450, ty);
      ty += 14;
      doc.moveTo(50, ty).lineTo(doc.page.width - 50, ty).strokeColor("#e4e4e7").stroke();
      ty += 8;

      students.slice(0, 40).forEach((s, i) => {
        if (ty > doc.page.height - 60) { doc.addPage(); ty = 50; }
        doc.fontSize(8).fillColor("#3f3f46").font("Helvetica");
        doc.text(String(i + 1), 50, ty);
        doc.text(s.displayName || "—", 90, ty, { width: 220 });
        doc.text(String(s.solvedSlugs?.length ?? 0), 320, ty);
        doc.text(String(s.currentStreak ?? 0), 380, ty);
        doc.text(String(s.totalXP ?? 0), 450, ty);
        ty += 16;
      });

      // Footer
      const footerY = doc.page.height - 40;
      doc.fontSize(8).fillColor("#a1a1aa").text(`Generated by Code Club · ${SITE_URL.replace("https://","")}`, 50, footerY, { align: "center", width: doc.page.width - 100 });

      doc.end();
    } catch (err) {
      (req.log || logger).error({ err }, "[TPO] report PDF error");
      if (!res.headersSent) res.status(500).json({ error: "Failed to generate report." });
    }
  });

export default router;