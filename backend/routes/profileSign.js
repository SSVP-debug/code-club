import { Router } from "express";
import crypto from "crypto";
import { getProfileSignSecret } from "../config/env.js";
import { getSolvedSlugs } from "../services/problemProgressService.js";

const router = Router();

// POST /api/profile/sign — student signs their own profile
router.post("/sign", async (req, res) => {
  try {
    if (!req.userDoc) return res.status(503).json({ error: "Database unavailable." });

    const secret     = getProfileSignSecret();
    const solvedCount = (await getSolvedSlugs(req.userDoc._id)).length;
    const signedAt   = new Date();
    const payload    = `${req.userDoc._id}:${solvedCount}:${signedAt.toISOString()}`;
    const hash       = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    req.userDoc.profileSignature = { hash, signedAt, solvedCount };
    await req.userDoc.save();

    return res.json({ success: true, signedAt, solvedCount });
  } catch (err) {
    req.log?.error?.({ err }, "[ProfileSign] sign failed");
    return res.status(500).json({ error: "Failed to sign profile." });
  }
});

export default router;