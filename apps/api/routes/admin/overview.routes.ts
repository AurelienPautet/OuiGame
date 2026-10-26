import express from "express";
import type { Request, Response } from "express";
const router = express.Router();
import { validate } from "../../middleware/validate.middleware";
import {
  AdminTimeseriesQuerySchema,
  type AdminTimeseriesQuery,
  AdminConnectedPlayersQuerySchema,
  type AdminConnectedPlayersQuery,
} from "@ouigame/shared/api";
import * as adminStatsService from "../../services/admin.stats.service";
import { getConnectedPlayers } from "../../socket/connectedPlayers";

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

// GET /api/admin/connected-players?type=&search= — real-time snapshot of connected players.
router.get(
  "/connected-players",
  validate({ query: AdminConnectedPlayersQuerySchema }),
  (req: Request, res: Response) => {
    const query = req.validatedQuery as AdminConnectedPlayersQuery;
    let data = getConnectedPlayers();

    if (query.type && query.type !== "all") {
      data = {
        ...data,
        players: data.players.filter((p) => p.type === query.type),
      };
    }

    if (query.search && query.search.trim().length > 0) {
      const q = query.search.trim().toLowerCase();
      data = {
        ...data,
        players: data.players.filter((p) => {
          const name = (p.user?.username || p.guestName || "").toLowerCase();
          const email = (p.user?.email || "").toLowerCase();
          const socketId = p.socketId.toLowerCase();
          const clientId = (p.clientId || "").toLowerCase();
          const ip = (p.ip || "").toLowerCase();
          const roomName = (p.room?.name || "").toLowerCase();
          return (
            name.includes(q) ||
            email.includes(q) ||
            socketId.includes(q) ||
            clientId.includes(q) ||
            ip.includes(q) ||
            roomName.includes(q)
          );
        }),
      };
    }

    res.json(data);
  }
);

export default router;
