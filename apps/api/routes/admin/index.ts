import express from "express";
const router = express.Router();

import { authMiddleware } from "../../middleware/auth.middleware";
import { adminMiddleware } from "../../middleware/admin.middleware";
import overviewRoutes from "./overview.routes";
import usersRoutes from "./users.routes";
import contentRoutes from "./content.routes";
import securityRoutes from "./security.routes";

// Every /api/admin/* route requires a valid session (authMiddleware) AND an
// admin player (adminMiddleware). Applying both here keeps the sub-routers free
// of auth plumbing.
router.use(authMiddleware, adminMiddleware);

router.use("/", overviewRoutes);
router.use("/users", usersRoutes);
router.use("/", contentRoutes);
router.use("/", securityRoutes);

export default router;
