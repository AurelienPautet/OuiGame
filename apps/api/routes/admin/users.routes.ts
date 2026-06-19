import express from "express";
import type { Request, Response } from "express";
const router = express.Router();
import { validate } from "../../middleware/validate.middleware";
import {
  AdminUsersQuerySchema,
  AdminIdParamSchema,
  AdminUpdateUserRequestSchema,
} from "@ouigame/shared/api";
import type { AdminUsersQuery } from "@ouigame/shared/api";
import * as usersService from "../../services/admin.users.service";
import { recordAudit } from "../../services/admin.audit";
import { badRequest, notFound } from "../../errors";

// authMiddleware + adminMiddleware are applied to ALL admin routes by
// routes/admin/index.ts, so they are intentionally absent here.

// GET /api/admin/users — paginated, filtered, sorted user table.
router.get(
  "/",
  validate({ query: AdminUsersQuerySchema }),
  async (req: Request, res: Response) => {
    const q = req.validatedQuery as AdminUsersQuery;
    // Defaults applied defensively: Zod's .default() does not survive
    // .optional(), so a missing key arrives as undefined.
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    const sort = q.sort ?? "created";
    const order = q.order ?? "desc";

    const result = await usersService.listUsers({
      search: q.search,
      type: q.type,
      sort,
      order,
      page,
      pageSize,
    });
    res.json(result);
  }
);

// GET /api/admin/users/:id — a single user's full profile.
router.get(
  "/:id",
  validate({ params: AdminIdParamSchema }),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    const detail = await usersService.getUserDetail(id);
    if (detail === null) {
      throw notFound("User not found");
    }
    res.json(detail);
  }
);

// PATCH /api/admin/users/:id — promote/demote (toggle is_admin).
router.patch(
  "/:id",
  validate({
    params: AdminIdParamSchema,
    body: AdminUpdateUserRequestSchema,
  }),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const actorId = req.user!.playerId;

    if (id === actorId) {
      throw badRequest("Cannot change your own admin status");
    }

    const player = await usersService.findPlayer(id);
    if (player === undefined) {
      throw notFound("User not found");
    }

    const { isAdmin } = req.body;
    if (isAdmin === undefined) {
      // Nothing to change; return the current list-item shape.
      const detail = await usersService.getUserDetail(id);
      res.json(detail);
      return;
    }

    const updated = await usersService.setIsAdmin(id, isAdmin);
    await recordAudit({
      actorId,
      action: "user.update_admin",
      targetType: "user",
      targetId: id,
      details: { isAdmin },
    });
    res.json(updated);
  }
);

// DELETE /api/admin/users/:id — remove a user account.
router.delete(
  "/:id",
  validate({ params: AdminIdParamSchema }),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const actorId = req.user!.playerId;

    if (id === actorId) {
      throw badRequest("Cannot delete your own account");
    }

    const player = await usersService.findPlayer(id);
    if (player === undefined) {
      throw notFound("User not found");
    }

    await usersService.deletePlayer(id);
    await recordAudit({
      actorId,
      action: "user.delete",
      targetType: "user",
      targetId: id,
      details: { username: player.username },
    });
    res.json({ success: true });
  }
);

export default router;
