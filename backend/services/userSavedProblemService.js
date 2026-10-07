import UserSavedProblem from "../models/UserSavedProblem.js";

export async function listSavedProblems(userId) {
  return UserSavedProblem.find({ userId })
    .select("problemSlug savedAt -_id")
    .sort({ savedAt: -1 })
    .lean();
}

export async function saveProblemForUser(userId, problemSlug) {
  await UserSavedProblem.updateOne(
    { userId, problemSlug },
    { $setOnInsert: { userId, problemSlug, savedAt: new Date() } },
    { upsert: true }
  );
  return listSavedProblems(userId);
}

export async function removeSavedProblemForUser(userId, problemSlug) {
  await UserSavedProblem.deleteOne({ userId, problemSlug });
  return listSavedProblems(userId);
}
