import express from "express";
const router = express.Router();

import authRoutes from "./auth.routes";
import levelsRoutes from "./levels.routes";
import statsRoutes from "./stats.routes";
import rankingsRoutes from "./rankings.routes";
import roomsRoutes from "./rooms.routes";
import soloRoutes from "./solo.routes";
import campaignsRoutes from "./campaigns.routes";

router.use("/auth", authRoutes);
router.use("/levels", levelsRoutes);
router.use("/stats", statsRoutes);
router.use("/rankings", rankingsRoutes);
router.use("/rooms", roomsRoutes);
router.use("/solo", soloRoutes);
router.use("/campaigns", campaignsRoutes);

export default router;
