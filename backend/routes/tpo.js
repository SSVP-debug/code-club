        : {
            emailDomain: domain,
            role: "student",
          };

      User.find(studentQuery)
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
    const domain = req.userDoc.tpoProfile?.collegeDomain?.toLowerCase();
    if (!domain && req.userDoc.role !== "admin") {
      return res.status(400).json({ error: "No college domain set on this TPO account." });
    }

    // TPO-4 multi-domain hardening: assignments belong to the institution,
    // not to the literal email domain of the TPO who created them. A TPO
    // from one domain of a multi-domain college must see assignments created
    // by teammates from the college's other domains as well.
    const collegeDomains = req.userDoc.role === "admin"
      ? null
      : await resolveCollegeDomains(req.userDoc);

    // TPO-4: legacy assignments remain college-wide. Cohort assignments
    // are measured only against active members of their target cohort.
    // Resolve all target cohorts/members in bounded bulk queries so the
    // dashboard does not perform one membership/user query per assignment.
    const assignmentQuery = collegeDomains?.length
      ? { collegeDomain: { $in: collegeDomains } }
      : {};
    const assignments = await Assignment.find(assignmentQuery)
      .sort({ dueDate: -1 })
      .lean();

    const cohortIds = assignments
      .filter((a) => a.cohortId)
      .map((a) => a.cohortId);

    const [cohorts, cohortMemberships] = cohortIds.length
      ? await Promise.all([
          Cohort.find({ _id: { $in: cohortIds } })
            .select("name academicYear graduatingYear branch section status collegeId")
            .lean(),
          CohortMembership.find({
            cohortId: { $in: cohortIds },
            status: "active",
            studentId: { $ne: null },
          })
            .select("cohortId studentId")
            .lean(),
        ])
      : [[], []];

    const cohortById = new Map(cohorts.map((cohort) => [String(cohort._id), cohort]));
    const studentIdsByCohort = new Map();
    for (const membership of cohortMemberships) {
      const key = String(membership.cohortId);
      if (!studentIdsByCohort.has(key)) studentIdsByCohort.set(key, new Set());
      studentIdsByCohort.get(key).add(String(membership.studentId));
    }

    const legacyStudents = collegeDomains?.length
      ? await User.find({ emailDomain: { $in: collegeDomains }, role: "student" })
          .select("_id solvedSlugs")
          .lean()
      : [];