import express from "express";
import type { Request, Response } from "express";
const router = express.Router();
import { authMiddleware } from "../middleware/auth.middleware";
import * as rankingsService from "../services/rankings.service";
import { badRequest } from "../errors";

// GET /api/rankings/:type
router.get("/:type", async (req: Request, res: Response) => {
  const { type } = req.params as { type: string };

  const result = await rankingsService.getRankings(type);
  if (result === undefined) {
    throw badRequest("Invalid ranking type");
  }
  res.json(result);
});

// GET /api/rankings/:type/me
router.get("/:type/me", authMiddleware, async (req: Request, res: Response) => {
  const { type } = req.params as { type: string };
  const playerId = req.user!.playerId;

  const userRank = await rankingsService.getPlayerRank(type, playerId);
  if (userRank === undefined) {
    throw badRequest("Invalid ranking type");
  }
  res.json(userRank);
});

export default router;
