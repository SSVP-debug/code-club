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
    [User, { createdAt: -1 }, "analytics_user_created_at"],
    [Submission, { createdAt: 1 }, "analytics_submission_created_at"],
    [ProblemStats, { accepted: 1 }, "analytics_problem_stats_accepted"],
  ];

  for (const [model, key, name] of indexes) {
    await model.collection.createIndex(key, { name });
    console.log(`[analytics-indexes] ensured ${name}`);
  }
} finally {
  await mongoose.disconnect();
}
