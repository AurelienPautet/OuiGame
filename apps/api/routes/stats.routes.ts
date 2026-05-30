import express from "express";
import type { Request, Response } from "express";
const router = express.Router();
import * as statsService from "../services/stats.service";
import { authMiddleware } from "../middleware/auth.middleware";

// GET /api/stats/me
router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  const playerId = req.user!.playerId;

  try {
    const stats = await statsService.getMyStats(playerId);
    res.json(stats);
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
