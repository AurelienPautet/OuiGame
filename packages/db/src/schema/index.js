const { players, playerSessions, passwordResetTokens } = require("./players");
const { levels, levelsImg } = require("./levels");
const { campaigns, campaignLevels, campaignRuns } = require("./campaigns");
const { ratings, logings, rounds, soloRounds } = require("./stats");
const { playerAchievements } = require("./achievements");

module.exports = {
  players,
  playerSessions,
  passwordResetTokens,
  levels,
  levelsImg,
  campaigns,
  campaignLevels,
  campaignRuns,
  ratings,
  logings,
  rounds,
  soloRounds,
  playerAchievements,
};
