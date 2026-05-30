const express = require("express");
const router = express.Router();

const authRoutes = require("./auth.routes");
const levelsRoutes = require("./levels.routes");
const statsRoutes = require("./stats.routes");
const rankingsRoutes = require("./rankings.routes");
const roomsRoutes = require("./rooms.routes");
const soloRoutes = require("./solo.routes");
const campaignsRoutes = require("./campaigns.routes");

router.use("/auth", authRoutes);
router.use("/levels", levelsRoutes);
router.use("/stats", statsRoutes);
router.use("/rankings", rankingsRoutes);
router.use("/rooms", roomsRoutes);
router.use("/solo", soloRoutes);
router.use("/campaigns", campaignsRoutes);

module.exports = router;
