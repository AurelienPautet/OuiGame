const {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  boolean,
} = require("drizzle-orm/pg-core");
const { players } = require("./players");
const { levels } = require("./levels");

const campaigns = pgTable("OuiTank-campaigns", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 30 }).notNull().unique(),
  creatorId: integer("creator_id")
    .notNull()
    .references(() => players.id),
  description: varchar("description", { length: 300 }).notNull(),
  creationTimestamp: timestamp("creation_timestamp").defaultNow(),
});

const campaignLevels = pgTable("OuiTank-campaign_levels", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  levelId: integer("level_id")
    .notNull()
    .references(() => levels.id),
  orderIndex: integer("order_index").notNull(),
});

// One row per campaign playthrough (a "run"). Mirrors solo_rounds: player_id is
// nullable so anonymous runs are still recorded (but only matter for logged-in
// players). A user's completion % for a campaign = MAX(levels_cleared) / total
// levels; "completed" = they have a run with completed = true.
const campaignRuns = pgTable("OuiTank-campaign_runs", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => players.id),
  campaignId: integer("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  levelsCleared: integer("levels_cleared").notNull(),
  livesLeft: integer("lives_left").notNull(),
  completed: boolean("completed").notNull(),
  timeMs: integer("time_ms").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

module.exports = { campaigns, campaignLevels, campaignRuns };
