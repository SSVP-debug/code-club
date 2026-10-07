import { Router } from "express";
import Playlist from "../models/Playlist.js";
import { getSolvedSlugs } from "../services/problemProgressService.js";

const router = Router();

const MAX_NAME_LENGTH = 80;
const MAX_PROBLEMS_PER_PLAYLIST = 200;

function serializePlaylist(doc, solvedSlugs = []) {
  const solvedSet = new Set(solvedSlugs);
  const solvedCount = doc.problemSlugs.filter((slug) => solvedSet.has(slug)).length;
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description || "",
    isOfficial: doc.isOfficial,
    ownerId: doc.ownerId ? doc.ownerId.toString() : null,
    problemSlugs: doc.problemSlugs || [],
    problemCount: doc.problemSlugs.length,
    solvedCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ── GET /api/playlists — official playlists + the caller's own ─────────────
router.get("/", async (req, res) => {
  try {
    const docs = await Playlist.find({
      $or: [{ isOfficial: true }, { ownerId: req.userDoc._id }],
    }).sort({ isOfficial: -1, createdAt: 1 });

    const solvedSlugs = await getSolvedSlugs(req.userDoc._id);
    res.json({ playlists: docs.map((d) => serializePlaylist(d, solvedSlugs)) });
  } catch (err) {
    req.log?.error?.({ err }, "[Playlists] GET / failed");
    res.status(500).json({ error: "Failed to load playlists." });
  }
});

// ── POST /api/playlists — create a custom playlist ──────────────────────────
router.post("/", async (req, res) => {
  try {
    const { name, description = "", problemSlugs = [] } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required." });
    }
    if (name.trim().length > MAX_NAME_LENGTH) {
      return res.status(400).json({ error: `name must be under ${MAX_NAME_LENGTH} characters.` });
    }
    if (!Array.isArray(problemSlugs)) {
      return res.status(400).json({ error: "problemSlugs must be an array." });
    }
    if (problemSlugs.length > MAX_PROBLEMS_PER_PLAYLIST) {
      return res.status(400).json({
        error: `A playlist can hold at most ${MAX_PROBLEMS_PER_PLAYLIST} problems.`,
      });
    }

    const doc = await Playlist.create({
      name: name.trim(),
      description: description.trim(),
      ownerId: req.userDoc._id,
      isOfficial: false,
      problemSlugs: [...new Set(problemSlugs)], // de-dupe defensively
    });

    res.status(201).json({ playlist: serializePlaylist(doc, await getSolvedSlugs(req.userDoc._id)) });
  } catch (err) {
    req.log?.error?.({ err }, "[Playlists] POST / failed");
    res.status(500).json({ error: "Failed to create playlist." });
  }
});

// ── PATCH /api/playlists/:id — rename / edit description / edit problems ───
// Frontend sends the full desired problemSlugs array on any reorder/add/
// remove (same "full replace" convention used for editing an ordered list
// elsewhere in this app) rather than single-item add/remove endpoints —
// simpler for drag-to-reorder, which needs to send a full new order anyway.
router.patch("/:id", async (req, res) => {
  try {
    const doc = await Playlist.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Playlist not found." });

    if (doc.isOfficial) {
      return res.status(403).json({ error: "Official playlists can't be edited." });
    }
    if (!doc.ownerId || doc.ownerId.toString() !== req.userDoc._id.toString()) {
      return res.status(403).json({ error: "You don't own this playlist." });
    }

    const { name, description, problemSlugs } = req.body;

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: "name can't be empty." });
      if (name.trim().length > MAX_NAME_LENGTH) {
        return res.status(400).json({ error: `name must be under ${MAX_NAME_LENGTH} characters.` });
      }
      doc.name = name.trim();
    }
    if (description !== undefined) {
      doc.description = String(description).trim();
    }
    if (problemSlugs !== undefined) {
      if (!Array.isArray(problemSlugs)) {
        return res.status(400).json({ error: "problemSlugs must be an array." });
      }
      if (problemSlugs.length > MAX_PROBLEMS_PER_PLAYLIST) {
        return res.status(400).json({
          error: `A playlist can hold at most ${MAX_PROBLEMS_PER_PLAYLIST} problems.`,
        });
      }
      doc.problemSlugs = problemSlugs;
    }

    await doc.save();

    res.json({ playlist: serializePlaylist(doc, await getSolvedSlugs(req.userDoc._id)) });
  } catch (err) {
    req.log?.error?.({ err }, "[Playlists] PATCH /:id failed");
    res.status(500).json({ error: "Failed to update playlist." });
  }
});

// ── DELETE /api/playlists/:id ────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const doc = await Playlist.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Playlist not found." });

    if (doc.isOfficial) {
      return res.status(403).json({ error: "Official playlists can't be deleted." });
    }
    if (!doc.ownerId || doc.ownerId.toString() !== req.userDoc._id.toString()) {
      return res.status(403).json({ error: "You don't own this playlist." });
    }

    await doc.deleteOne();

    res.json({ deleted: true });
  } catch (err) {
    req.log?.error?.({ err }, "[Playlists] DELETE /:id failed");
    res.status(500).json({ error: "Failed to delete playlist." });
  }
});

export default router;