import express from "express";
import type { Request, Response } from "express";
const router = express.Router();
import * as soloService from "../services/solo.service";
import { authMiddleware, optionalAuth } from "../middleware/auth.middleware";

// POST /api/solo/rounds - Submit a solo round
// Uses optional auth - logged in players get their ID attached, anonymous still tracked
router.post("/rounds", optionalAuth, async (req: Request, res: Response) => {
  // playerId is null for anonymous players
  const playerId = req.user?.playerId || null;

  try {
    const ok = await soloService.submitRound(playerId, req.body);
    if (!ok) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Error submitting solo round:", err);
    res.status(500).json({ error: "Failed to submit round" });
  }
});

// GET /api/solo/levels/:id/stats - Get stats for a specific level
router.get("/levels/:id/stats", async (req: Request, res: Response) => {
  const levelId = parseInt(req.params.id as string);

  try {
    const stats = await soloService.getLevelStats(levelId);
    res.json(stats);
  } catch (err) {
    console.error("Error fetching level stats:", err);
    res.status(500).json({ error: "Failed to fetch level stats" });
  }
});

// GET /api/solo/levels/:id/leaderboard - Per-level leaderboard (best times)
// Includes anonymous players
router.get("/levels/:id/leaderboard", async (req: Request, res: Response) => {
  const levelId = parseInt(req.params.id as string);
  const limit = parseInt(req.query.limit as string) || 20;

  try {
    const leaderboard = await soloService.getLevelLeaderboard(levelId, limit);
    res.json(leaderboard);
  } catch (err) {
    console.error("Error fetching level leaderboard:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// GET /api/solo/leaderboard/:type - Global solo leaderboard by type
// Only logged-in players (excludes anonymous)
// Types: LEVELS_COMPLETED, LEVELS_PLAYED, KILLS
router.get("/leaderboard/:type", async (req: Request, res: Response) => {
  const { type } = req.params as { type: string };
  const limit = parseInt(req.query.limit as string) || 50;

  try {
    const leaderboard = await soloService.getGlobalLeaderboard(type, limit);
    // null signals an unknown ranking type (validated before any DB call).
    if (leaderboard === null) {
      return res.status(400).json({ error: "Invalid ranking type" });
    }
    res.json(leaderboard);
  } catch (err) {
    console.error("Error fetching global solo leaderboard:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// GET /api/solo/stats/me - Current user's solo stats
router.get("/stats/me", authMiddleware, async (req: Request, res: Response) => {
  const playerId = req.user!.playerId;

  try {
    const stats = await soloService.getMyStats(playerId);
    res.json(stats);
  } catch (err) {
    console.error("Error fetching my solo stats:", err);
    res.status(500).json({ error: "Failed to fetch your solo stats" });
  }
});

export default router;
