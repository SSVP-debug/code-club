import { hasCompletedDailyChallenge, recordDailyChallengeCompletion } from "../services/dailyChallengeService.js";
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

    const alreadyCompleted = await hasCompletedDailyChallenge(req.userDoc._id, today, slug);

    if (alreadyCompleted) {
      return res.json({
        success: true,
        alreadyCompleted: true,
      });
    }

    await recordDailyChallengeCompletion(req.userDoc._id, today, slug, new Date());

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