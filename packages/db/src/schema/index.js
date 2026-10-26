const { players, playerSessions, playerSettings } = require("./players");
const { levels, levelsImg } = require("./levels");
const { campaigns, campaignLevels, campaignRuns } = require("./campaigns");
const {
  ratings,
  logings,
  rounds,
  soloRounds,
  playSessions,
  dailyActiveUsers,
} = require("./stats");
const { playerAchievements } = require("./achievements");
const { adminAuditLog } = require("./admin");

module.exports = {
  players,
  playerSessions,
  playerSettings,
  levels,
  levelsImg,
  campaigns,
  campaignLevels,
  campaignRuns,
  ratings,
  logings,
  rounds,
  soloRounds,
  playSessions,
  dailyActiveUsers,
  playerAchievements,
  adminAuditLog,
};
