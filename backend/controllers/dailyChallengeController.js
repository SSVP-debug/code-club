import { saveProgress } from "../services/userProgressService.js";
import { getStudentDayKey } from "../utils/studentDay.js";

export async function completeDailyChallenge(
  req,
  res
) {
  try {
    const { slug } = req.body;

    if (!slug) {
      return res.status(400).json({
        error: "Missing slug",
      });
    }

    const today = getStudentDayKey();

    const alreadyCompleted =
      (req.userDoc.dailyChallengeHistory || []).some(
        (entry) =>
          entry.date === today &&
          entry.slug === slug
      );

    if (alreadyCompleted) {
      return res.json({
        success: true,
        alreadyCompleted: true,
      });
    }

    req.userDoc.dailyChallengeHistory.push({
      date: today,
      slug,
      completed: true,
      completedAt: new Date(),
    });

    // Dual-writes to User (still authoritative — see userProgressService)
    // and UserProgress (docs/migrations/user-model-split.md, Phase 1 step 3),
    // instead of userDoc.save() directly.
    await saveProgress(req.userDoc._id, {
      dailyChallengeHistory: req.userDoc.dailyChallengeHistory,
    });

    res.json({
      success: true,
      alreadyCompleted: false,
    });
  } catch (err) {
    req.log.error({ err }, "[Daily Challenge] completeDailyChallenge failed");

    res.status(500).json({
      error: "Failed to save daily challenge",
    });
  }
}