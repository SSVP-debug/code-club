import { Router } from "express";

import {
  getPublicProfile,
  listPublicProfileUsernames,
} from "../controllers/publicProfileController.js";

const router = Router();

// Build-time sitemap discovery: returns usernames only for opted-in public profiles.
router.get("/sitemap-profiles", listPublicProfileUsernames);

router.get(
  "/u/:username",
  getPublicProfile
);

export default router;