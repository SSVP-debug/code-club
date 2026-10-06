import Contest from "../models/Contest.js";
import ContestParticipant from "../models/ContestParticipant.js";

export async function canAccessContestProblem(slug, userDoc) {
  const contests = await Contest.find({ problemSlugs: slug })
    .select("startsAt endsAt createdBy")
    .lean();

  if (contests.length === 0) return false;

  const userId = userDoc?._id ?? null;
  const now = new Date();
  const activeContestIds = [];

  for (const contest of contests) {
    const status =
      now < new Date(contest.startsAt) ? "upcoming"
      : now > new Date(contest.endsAt) ? "ended"
      : "active";

    if (status === "ended") return true;
    if (!userId) continue;
    if (contest.createdBy?.toString() === userId.toString()) return true;
    if (status === "active") activeContestIds.push(contest._id);
  }

  if (!activeContestIds.length) return false;
  return !!(await ContestParticipant.exists({
    contestId: { $in: activeContestIds },
    userId,
  }));
}
