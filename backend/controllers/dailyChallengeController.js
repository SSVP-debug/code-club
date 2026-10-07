import DailyChallengeCompletion from "../models/DailyChallengeCompletion.js";
import { getStudentDayKey } from "../utils/studentDay.js";

export async function completeDailyChallenge(req, res) {
  try {
    const { slug } = req.body;

    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const today = getStudentDayKey();

    const completion = await DailyChallengeCompletion.findOneAndUpdate(
      { userId: req.userDoc._id, date: today },
      {
        $setOnInsert: {
          userId: req.userDoc._id,
          date: today,
          slug,
          completedAt: new Date(),
        },
      },
      { upsert: true, new: false }
    );

    return res.json({
      success: true,
      alreadyCompleted: !!completion,
    });
  } catch (err) {
    req.log.error({ err }, "[Daily Challenge] completeDailyChallenge failed");
    return res.status(500).json({ error: "Failed to save daily challenge" });
  }
}
