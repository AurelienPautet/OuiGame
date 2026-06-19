import express from "express";
import type { Request, Response } from "express";
const router = express.Router();
import { validate } from "../../middleware/validate.middleware";
import {
  AdminLoginsQuerySchema,
  AdminPagedQuerySchema,
  type AdminLoginsQuery,
  type AdminPagedQuery,
} from "@ouigame/shared/api";
import * as securityService from "../../services/admin.security.service";

// authMiddleware + adminMiddleware are applied to every admin route in
// routes/admin/index.ts, so they are intentionally absent here.

// GET /api/admin/logins?search=&status=&page=&pageSize= — paginated login
// attempt log. Optional status substring filter; search matches username OR ip.
router.get(
  "/logins",
  validate({ query: AdminLoginsQuerySchema }),
  async (req: Request, res: Response) => {
    const q = req.validatedQuery as AdminLoginsQuery;
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;

    const result = await securityService.listLogins({
      search: q.search,
      status: q.status,
      page,
      pageSize,
    });
    res.json(result);
  }
);

// GET /api/admin/audit?search=&page=&pageSize= — paginated admin action audit
// trail. search matches the action string.
router.get(
  "/audit",
  validate({ query: AdminPagedQuerySchema }),
  async (req: Request, res: Response) => {
    const q = req.validatedQuery as AdminPagedQuery;
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;

    const result = await securityService.listAudit({
      search: q.search,
      page,
      pageSize,
    });
    res.json(result);
  }
);

export default router;
