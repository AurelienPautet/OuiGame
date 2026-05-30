import express from "express";
import type { Request, Response } from "express";
const router = express.Router();
import { authMiddleware } from "../middleware/auth.middleware";
import * as rankingsService from "../services/rankings.service";

// GET /api/rankings/:type
router.get("/:type", async (req: Request, res: Response) => {
  const { type } = req.params as { type: string };

  try {
    const result = await rankingsService.getRankings(type);
    if (result === undefined) {
      return res.status(400).json({ error: "Invalid ranking type" });
    }
    res.json(result);
  } catch (err) {
    console.error("Error fetching rankings:", err);
    res.status(500).json({ error: "Failed to fetch rankings" });
  }
});

// GET /api/rankings/:type/me
router.get("/:type/me", authMiddleware, async (req: Request, res: Response) => {
  const { type } = req.params as { type: string };
  const playerId = req.user!.playerId;

  try {
    const userRank = await rankingsService.getPlayerRank(type, playerId);
    if (userRank === undefined) {
      return res.status(400).json({ error: "Invalid ranking type" });
    }
    res.json(userRank);
  } catch (err) {
    console.error("Error fetching personal rank:", err);
    res.status(500).json({ error: "Failed to fetch your rank" });
  }
});

export default router;
