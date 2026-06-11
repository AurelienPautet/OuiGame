import express from "express";
import type { Request, Response } from "express";
const router = express.Router();
import { authMiddleware } from "../middleware/auth.middleware";
import * as achievementsService from "../services/achievements.service";

// GET /api/achievements/me - the authenticated player's unlocked achievements.
// The catalog (locked + unlocked) lives in the client; this returns only the
// unlocked rows + timestamps, which the client merges against the catalog.
router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  const playerId = req.user!.playerId;
  const unlocked = await achievementsService.getMyAchievements(playerId);
  res.json(unlocked);
});

export default router;
