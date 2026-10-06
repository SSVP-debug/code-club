import mongoose from "mongoose";
import "dotenv/config";
import User from "../models/User.js";

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!uri) {
  throw new Error("MONGODB_URI or MONGO_URI must be configured");
}

try {
  await mongoose.connect(uri);

  const indexes = [
    {
      key: { isProfilePublic: 1, totalXP: -1, _id: 1 },
      name: "leaderboard_global_public_xp",
    },
    {
      key: { emailDomain: 1, isProfilePublic: 1, totalXP: -1, _id: 1 },
      name: "leaderboard_college_domain_public_xp",
    },
  ];

  for (const index of indexes) {
    await User.collection.createIndex(index.key, { name: index.name });
    console.log(`[leaderboard-indexes] ensured ${index.name}`);
  }
} finally {
  await mongoose.disconnect();
}
