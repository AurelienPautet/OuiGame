import express from "express";
import type { Request, Response } from "express";
const router = express.Router();
import { parseId } from "../repositories/shared/format";
import * as service from "../services/campaigns.service";
import { authMiddleware, optionalAuth } from "../middleware/auth.middleware";
import { badRequest } from "../errors";

// GET /api/campaigns?name=
router.get("/", optionalAuth, async (req: Request, res: Response) => {
  const { name = "" } = req.query as { name?: string };
  const playerId = req.user?.playerId ?? null;
  res.json(await service.listCampaigns(name, playerId));
});

// GET /api/campaigns/my?name=
router.get("/my", authMiddleware, async (req: Request, res: Response) => {
  const { name = "" } = req.query as { name?: string };
  const playerId = req.user!.playerId;
  res.json(await service.listMyCampaigns(name, playerId));
});

// GET /api/campaigns/:id  (campaign meta + ordered levels + this user's progress)
router.get("/:id", optionalAuth, async (req: Request, res: Response) => {
  const campaignId = parseId(req.params.id);
  if (campaignId === null) {
    throw badRequest("Invalid campaign id");
  }
  const playerId = req.user?.playerId ?? null;
  res.json(await service.getCampaignDetail(campaignId, playerId));
});

// POST /api/campaigns  { name, description, levelIds: [] }
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const { name, levelIds } = req.body;
  // Coerce to a string: the destructuring default only covers `undefined`, so a
  // null/number `description` would otherwise skip validation and hit the
  // NOT NULL column at insert time (500).
  const description =
    typeof req.body.description === "string" ? req.body.description : "";
  const playerId = req.user!.playerId;

  if (typeof name !== "string" || name.trim().length === 0) {
    throw badRequest("Campaign name is required");
  }
  if (name.length > 30) {
    throw badRequest("Campaign name too long (max 30)");
  }
  if (description.length > 300) {
    throw badRequest("Campaign description too long (max 300)");
  }

  // A duplicate name surfaces as a 409 from the service (it translates the
  // Postgres unique violation), reaching the central error handler.
  const result = await service.createCampaign({
    name,
    description,
    creatorId: playerId,
    levelIds,
  });
  res.json(result);
});

// PUT /api/campaigns/:id  { name, description, levelIds: [] }
router.put("/:id", authMiddleware, async (req: Request, res: Response) => {
  const campaignId = parseId(req.params.id);
  if (campaignId === null) {
    throw badRequest("Invalid campaign id");
  }
  const { name, levelIds } = req.body;
  const description =
    typeof req.body.description === "string" ? req.body.description : "";
  const playerId = req.user!.playerId;

  if (typeof name !== "string" || name.trim().length === 0) {
    throw badRequest("Campaign name is required");
  }
  if (name.length > 30) {
    throw badRequest("Campaign name too long (max 30)");
  }
  if (description.length > 300) {
    throw badRequest("Campaign description too long (max 300)");
  }

  const result = await service.updateCampaign({
    campaignId,
    name,
    description,
    playerId,
    levelIds,
  });
  res.json(result);
});

// DELETE /api/campaigns/:id
router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  const campaignId = parseId(req.params.id);
  if (campaignId === null) {
    throw badRequest("Invalid campaign id");
  }
  const playerId = req.user!.playerId;
  res.json(await service.deleteCampaign(campaignId, playerId));
});

// POST /api/campaigns/:id/runs  { levelsCleared, livesLeft, completed, timeMs }
// optionalAuth: anonymous runs are accepted (player_id null) but only matter
// for logged-in players. Mirrors POST /api/solo/rounds.
router.post("/:id/runs", optionalAuth, async (req: Request, res: Response) => {
  const campaignId = parseId(req.params.id);
  if (campaignId === null) {
    throw badRequest("Invalid campaign id");
  }
  const { levelsCleared, livesLeft, completed, timeMs } = req.body;
  // Validate types/ranges explicitly rather than coercing, so bad input (e.g.
  // completed: "false", negative counts) can't be silently recorded as truthy.
  const isNonNegInt = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
  if (
    !isNonNegInt(levelsCleared) ||
    typeof completed !== "boolean" ||
    !isNonNegInt(timeMs) ||
    (livesLeft !== undefined && !isNonNegInt(livesLeft))
  ) {
    throw badRequest("Invalid or missing run fields");
  }

  const playerId = req.user?.playerId || null;
  const result = await service.submitRun({
    campaignId,
    playerId,
    levelsCleared,
    livesLeft,
    completed,
    timeMs,
  });
  res.json(result);
});

export default router;
