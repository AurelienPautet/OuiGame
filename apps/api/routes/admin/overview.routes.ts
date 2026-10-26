import express from "express";
import type { Request, Response } from "express";
const router = express.Router();
import { validate } from "../../middleware/validate.middleware";
import {
  AdminTimeseriesQuerySchema,
  type AdminTimeseriesQuery,
} from "@ouigame/shared/api";
import * as adminStatsService from "../../services/admin.stats.service";

// authMiddleware + adminMiddleware are applied to ALL admin routes by the parent
// router (routes/admin/index.ts), so these handlers carry no auth plumbing.

// GET /api/admin/overview — the headline dashboard metrics.
router.get("/overview", async (_req: Request, res: Response) => {
  const overview = await adminStatsService.getOverview();
  res.json(overview);
});

// GET /api/admin/timeseries?days=&range= — contiguous series (default 30 days, or hourly for 24h).
router.get(
  "/timeseries",
  validate({ query: AdminTimeseriesQuerySchema }),
  async (req: Request, res: Response) => {
    const query = req.validatedQuery as AdminTimeseriesQuery;
    const series = await adminStatsService.getTimeseries(query);
    res.json(series);
  }
);

export default router;
