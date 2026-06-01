import express from "express";
import type { Request, Response } from "express";
const router = express.Router();
import { authMiddleware } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { SaveLevelRequestSchema } from "@ouigame/shared/api";
import { parseId } from "../repositories/shared/format";
import * as levelsService from "../services/levels.service";
import { badRequest, forbidden, notFound } from "../errors";

// GET /api/levels?name=&players=&type=solo|online
router.get("/", async (req: Request, res: Response) => {
  const {
    name = "",
    players: playerCount = 0,
    type = "online",
  } = req.query as { name?: string; players?: string; type?: string };
  const maxPlayers = parseInt(playerCount as string);

  const formatted = await levelsService.listLevels({ name, type, maxPlayers });
  res.json(formatted);
});

// GET /api/levels/my?name=&players=
router.get("/my", authMiddleware, async (req: Request, res: Response) => {
  const { name = "", players: playerCount = 0 } = req.query as {
    name?: string;
    players?: string;
  };
  const maxPlayers = parseInt(playerCount as string);
  const playerId = req.user!.playerId;

  const formatted = await levelsService.listMyLevels(playerId, {
    name,
    maxPlayers,
  });
  res.json(formatted);
});

// GET /api/levels/:id
router.get("/:id", async (req: Request, res: Response) => {
  const levelId = parseId(req.params.id);
  if (levelId === null) {
    throw badRequest("Invalid level id");
  }

  const level = await levelsService.getLevel(levelId);
  if (level === null) {
    throw notFound("Level not found");
  }
  res.json(level);
});

// GET /api/levels/:id/json
router.get("/:id/json", async (req: Request, res: Response) => {
  const levelId = parseId(req.params.id);
  if (levelId === null) {
    throw badRequest("Invalid level id");
  }

  const json = await levelsService.getLevelJson(levelId);
  if (json === null) {
    throw notFound("Level not found");
  }
  res.json(json);
});

// POST /api/levels
router.post(
  "/",
  authMiddleware,
  validate({ body: SaveLevelRequestSchema }),
  async (req: Request, res: Response) => {
    const { levelData, hexData, levelName, maxPlayers, type } = req.body;
    const playerId = req.user!.playerId;

    const result = await levelsService.saveLevel(playerId, {
      levelData,
      hexData,
      levelName,
      maxPlayers,
      type,
    });
    res.json(result);
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
      throw badRequest("Invalid level id");
    }
    const { levelData, hexData, levelName, maxPlayers, type } = req.body;
    const playerId = req.user!.playerId;

    const result = await levelsService.updateLevel(playerId, levelId, {
      levelData,
      hexData,
      levelName,
      maxPlayers,
      type,
    });
    if (result === null) {
      throw forbidden("Not your level");
    }
    res.json(result);
  }
);

// DELETE /api/levels/:id
router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  const levelId = parseId(req.params.id);
  if (levelId === null) {
    throw badRequest("Invalid level id");
  }
  const playerId = req.user!.playerId;

  const deleted = await levelsService.deleteLevel(playerId, levelId);
  if (!deleted) {
    throw forbidden("Not your level");
  }
  res.json({ success: true });
});

// POST /api/levels/:id/rate
router.post(
  "/:id/rate",
  authMiddleware,
  async (req: Request, res: Response) => {
    const levelId = parseId(req.params.id);
    if (levelId === null) {
      throw badRequest("Invalid level id");
    }
    const { stars } = req.body;
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      throw badRequest("stars must be an integer 1-5");
    }
    const playerId = req.user!.playerId;

    await levelsService.rateLevel(playerId, levelId, stars);
    res.json({ success: true, stars, levelId });
  }
);

export default router;
