import express from "express";
import type { Request, Response } from "express";
const router = express.Router();
import { authMiddleware } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { SaveLevelRequestSchema } from "@ouigame/shared/api";
import { parseId } from "../repositories/shared/format";
import * as levelsService from "../services/levels.service";

// GET /api/levels?name=&players=&type=solo|online
router.get("/", async (req: Request, res: Response) => {
  const {
    name = "",
    players: playerCount = 0,
    type = "online",
  } = req.query as { name?: string; players?: string; type?: string };
  const maxPlayers = parseInt(playerCount as string);

  try {
    const formatted = await levelsService.listLevels({
      name,
      type,
      maxPlayers,
    });
    res.json(formatted);
  } catch (err) {
    console.error("Error fetching levels:", err);
    res.status(500).json({ error: "Failed to fetch levels" });
  }
});

// GET /api/levels/my?name=&players=
router.get("/my", authMiddleware, async (req: Request, res: Response) => {
  const { name = "", players: playerCount = 0 } = req.query as {
    name?: string;
    players?: string;
  };
  const maxPlayers = parseInt(playerCount as string);
  const playerId = req.user!.playerId;

  try {
    const formatted = await levelsService.listMyLevels(playerId, {
      name,
      maxPlayers,
    });
    res.json(formatted);
  } catch (err) {
    console.error("Error fetching my levels:", err);
    res.status(500).json({ error: "Failed to fetch your levels" });
  }
});

// GET /api/levels/:id
router.get("/:id", async (req: Request, res: Response) => {
  const levelId = parseId(req.params.id);
  if (levelId === null) {
    return res.status(400).json({ error: "Invalid level id" });
  }

  try {
    const level = await levelsService.getLevel(levelId);
    if (level === null) {
      return res.status(404).json({ error: "Level not found" });
    }
    res.json(level);
  } catch (err) {
    console.error("Error fetching level:", err);
    res.status(500).json({ error: "Failed to fetch level" });
  }
});

// GET /api/levels/:id/json
router.get("/:id/json", async (req: Request, res: Response) => {
  const levelId = parseId(req.params.id);
  if (levelId === null) {
    return res.status(400).json({ error: "Invalid level id" });
  }

  try {
    const json = await levelsService.getLevelJson(levelId);
    if (json === null) {
      return res.status(404).json({ error: "Level not found" });
    }
    res.json(json);
  } catch (err) {
    console.error("Error fetching level JSON:", err);
    res.status(500).json({ error: "Failed to fetch level data" });
  }
});

// POST /api/levels
router.post(
  "/",
  authMiddleware,
  validate({ body: SaveLevelRequestSchema }),
  async (req: Request, res: Response) => {
    const { levelData, hexData, levelName, maxPlayers, type } = req.body;
    const playerId = req.user!.playerId;

    try {
      const result = await levelsService.saveLevel(playerId, {
        levelData,
        hexData,
        levelName,
        maxPlayers,
        type,
      });
      res.json(result);
    } catch (err) {
      console.error("Error creating level:", err);
      res.status(500).json({ error: "Failed to create level" });
    }
  }
);

// PUT /api/levels/:id
router.put(
  "/:id",
  authMiddleware,
  validate({ body: SaveLevelRequestSchema }),
  async (req: Request, res: Response) => {
    const levelId = parseId(req.params.id);
    if (levelId === null) {
      return res.status(400).json({ error: "Invalid level id" });
    }
    const { levelData, hexData, levelName, maxPlayers, type } = req.body;
    const playerId = req.user!.playerId;

    try {
      const result = await levelsService.updateLevel(playerId, levelId, {
        levelData,
        hexData,
        levelName,
        maxPlayers,
        type,
      });
      if (result === null) {
        return res.status(403).json({ error: "Not your level" });
      }
      res.json(result);
    } catch (err) {
      console.error("Error updating level:", err);
      res.status(500).json({ error: "Failed to update level" });
    }
  }
);

// DELETE /api/levels/:id
router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  const levelId = parseId(req.params.id);
  if (levelId === null) {
    return res.status(400).json({ error: "Invalid level id" });
  }
  const playerId = req.user!.playerId;

  try {
    const deleted = await levelsService.deleteLevel(playerId, levelId);
    if (!deleted) {
      return res.status(403).json({ error: "Not your level" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting level:", err);
    res.status(500).json({ error: "Failed to delete level" });
  }
});

// POST /api/levels/:id/rate
router.post(
  "/:id/rate",
  authMiddleware,
  async (req: Request, res: Response) => {
    const levelId = parseId(req.params.id);
    if (levelId === null) {
      return res.status(400).json({ error: "Invalid level id" });
    }
    const { stars } = req.body;
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return res.status(400).json({ error: "stars must be an integer 1-5" });
    }
    const playerId = req.user!.playerId;

    try {
      await levelsService.rateLevel(playerId, levelId, stars);
      res.json({ success: true, stars, levelId });
    } catch (err) {
      console.error("Error rating level:", err);
      res.status(500).json({ error: "Failed to rate level" });
    }
  }
);

export default router;
