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
    // OWNERSHIP: deleting a player removes their campaigns (NOT NULL → cascade).
    .references(() => players.id, { onDelete: "cascade" }),
  description: varchar("description", { length: 300 }).notNull(),
  creationTimestamp: timestamp("creation_timestamp").defaultNow(),
});

const campaignLevels = pgTable("OuiTank-campaign_levels", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id")
    .notNull()
    // OWNERSHIP: a campaign's level-list rows die with the campaign
    // (replaces a manual cascade in the DELETE route).
    .references(() => campaigns.id, { onDelete: "cascade" }),
  levelId: integer("level_id")
    .notNull()
    // OWNERSHIP-of-level: deleting a level removes it from every campaign
    // (fixes a latent FK-violation when a campaigned level was deleted).
    .references(() => levels.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
});

// One row per campaign playthrough (a "run"). Mirrors solo_rounds: player_id is
// nullable so anonymous runs are still recorded (but only matter for logged-in
// players). A user's completion % for a campaign = MAX(levels_cleared) / total
// levels; "completed" = they have a run with completed = true.
const campaignRuns = pgTable("OuiTank-campaign_runs", {
  id: serial("id").primaryKey(),
  // ANALYTICS: run history outlives the player (nullable → set null).
  playerId: integer("player_id").references(() => players.id, {
    onDelete: "set null",
  }),
  campaignId: integer("campaign_id")
    .notNull()
    // OWNERSHIP: runs die with their campaign (replaces a manual cascade).
    .references(() => campaigns.id, { onDelete: "cascade" }),
  levelsCleared: integer("levels_cleared").notNull(),
  livesLeft: integer("lives_left").notNull(),
  completed: boolean("completed").notNull(),
  timeMs: integer("time_ms").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

module.exports = { campaigns, campaignLevels, campaignRuns };
