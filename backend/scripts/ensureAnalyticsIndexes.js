import mongoose from "mongoose";
import "dotenv/config";
import User from "../models/User.js";
import Submission from "../models/Submission.js";
import ProblemStats from "../models/ProblemStats.js";

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) throw new Error("MONGODB_URI or MONGO_URI must be configured");

try {
  await mongoose.connect(uri);

  const indexes = [
    // Registration analytics use the User model's explicit signup timestamp.
    [User, { joinedDate: -1 }, "analytics_user_joined_date"],
    // Submission trend, active-user, and retention windows all filter by createdAt.
    [Submission, { createdAt: 1 }, "analytics_submission_created_at"],
    // Problem popularity ranks by accepted count with a deterministic slug tie-breaker.
    [ProblemStats, { accepted: -1, problemSlug: 1 }, "analytics_problem_stats_accepted_desc"],
    [ProblemStats, { accepted: 1, problemSlug: 1 }, "analytics_problem_stats_accepted_asc"],
  ];

  for (const [model, key, name] of indexes) {
    await model.collection.createIndex(key, { name });
    console.log(`[analytics-indexes] ensured ${name}`);
  }
} finally {
  await mongoose.disconnect();
}
