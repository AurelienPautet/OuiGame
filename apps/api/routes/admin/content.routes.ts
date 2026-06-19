import express from "express";
import type { Request, Response } from "express";
const router = express.Router();
import { validate } from "../../middleware/validate.middleware";
import {
  AdminLevelsQuerySchema,
  AdminPagedQuerySchema,
  AdminUpdateLevelRequestSchema,
  AdminIdParamSchema,
  type AdminLevelsQuery,
  type AdminPagedQuery,
} from "@ouigame/shared/api";
import * as contentService from "../../services/admin.content.service";
import { recordAudit } from "../../services/admin.audit";
import { notFound } from "../../errors";

// authMiddleware + adminMiddleware are applied to every admin route in
// routes/admin/index.ts, so they are intentionally absent here.

// GET /api/admin/levels?search=&status=&sort=&order=&page=&pageSize= —
// paginated level catalog with play/rating aggregates. search matches the name
// (ilike), status filters up/down, sort is created|plays|rating|name.
router.get(
  "/levels",
  validate({ query: AdminLevelsQuerySchema }),
  async (req: Request, res: Response) => {
    const q = req.validatedQuery as AdminLevelsQuery;
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;

    const result = await contentService.listLevels({
      search: q.search,
      status: q.status,
      sort: q.sort,
      order: q.order,
      page,
      pageSize,
    });
    res.json(result);
  }
);

// PATCH /api/admin/levels/:id — moderate (publish/unpublish). 404 if missing.
router.patch(
  "/levels/:id",
  validate({ params: AdminIdParamSchema, body: AdminUpdateLevelRequestSchema }),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { status } = req.body as { status?: "up" | "down" };

    const level = await contentService.getLevel(id);
    if (level === null) {
      throw notFound("Level not found");
    }

    if (status !== undefined) {
      await contentService.setLevelStatus(id, status);
    }

    await recordAudit({
      actorId: req.user!.playerId,
      action: "level.update_status",
      targetType: "level",
      targetId: id,
      details: { status },
    });

    res.json({ success: true });
  }
);

// DELETE /api/admin/levels/:id — remove a level (children cascade). 404 if
// missing.
router.delete(
  "/levels/:id",
  validate({ params: AdminIdParamSchema }),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    const level = await contentService.getLevel(id);
    if (level === null) {
      throw notFound("Level not found");
    }

    await contentService.deleteLevel(id);

    await recordAudit({
      actorId: req.user!.playerId,
      action: "level.delete",
      targetType: "level",
      targetId: id,
      details: { name: level.name },
    });

    res.json({ success: true });
  }
);

// GET /api/admin/campaigns?search=&page=&pageSize= — paginated campaign catalog
// with level/run aggregates. search matches the name (ilike).
router.get(
  "/campaigns",
  validate({ query: AdminPagedQuerySchema }),
  async (req: Request, res: Response) => {
    const q = req.validatedQuery as AdminPagedQuery;
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;

    const result = await contentService.listCampaigns({
      search: q.search,
      page,
      pageSize,
    });
    res.json(result);
  }
);

// DELETE /api/admin/campaigns/:id — remove a campaign (runs + level links
// cascade). 404 if missing.
router.delete(
  "/campaigns/:id",
  validate({ params: AdminIdParamSchema }),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    const campaign = await contentService.getCampaign(id);
    if (campaign === null) {
      throw notFound("Campaign not found");
    }

    await contentService.deleteCampaign(id);

    await recordAudit({
      actorId: req.user!.playerId,
      action: "campaign.delete",
      targetType: "campaign",
      targetId: id,
      details: { name: campaign.name },
    });

    res.json({ success: true });
  }
);

export default router;
