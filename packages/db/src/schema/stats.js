const {
  pgTable,
  serial,
  integer,
  varchar,
  timestamp,
  unique,
  boolean,
  index,
} = require("drizzle-orm/pg-core");
const { players } = require("./players");
const { levels } = require("./levels");

const ratings = pgTable(
  "OuiTank-ratings",
  {
    id: serial("id").primaryKey(),
    stars: integer("stars").notNull(),
    levelId: integer("level_id")
      .notNull()
      // OWNERSHIP: a rating belongs to its level (replaces a manual cascade).
      .references(() => levels.id, { onDelete: "cascade" }),
    playerId: integer("player_id")
      .notNull()
      // OWNERSHIP: deleting a player removes their ratings (NOT NULL → cascade).
      .references(() => players.id, { onDelete: "cascade" }),
  },
  (table) => ({
    uniqueRating: unique().on(table.levelId, table.playerId),
  })
);

const logings = pgTable("OuiTank-logings", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .notNull()
    // Audit log keyed to a player. Ideally SET NULL for retention, but the
    // column is NOT NULL → cascade is the safe NOT-NULL-compatible choice.
    // TODO (later): relax to nullable + SET NULL to keep the audit trail.
    .references(() => players.id, { onDelete: "cascade" }),
  ipAddress: varchar("ip_address").notNull(),
  attemptTimestamp: timestamp("attempt_timestamp").defaultNow(),
  status: varchar("status", { length: 30 }).notNull(),
});

const rounds = pgTable(
  "OuiTank-rounds",
  {
    id: serial("id").primaryKey(),
    // ANALYTICS: round history outlives the player (nullable → set null).
    playerId: integer("player_id").references(() => players.id, {
      onDelete: "set null",
    }),
    levelId: integer("level_id")
      .notNull()
      // Deleting a level removes its round records (NOT NULL → cascade; also
      // fixes a latent FK-violation when a played level was deleted).
      .references(() => levels.id, { onDelete: "cascade" }),
    wins: integer("wins").notNull(),
    kills: integer("kills").notNull(),
    deaths: integer("deaths").notNull(),
    shots: integer("shots").notNull(),
    hits: integer("hits").notNull(),
    plants: integer("plants").notNull(),
    blocksDestroyed: integer("blocks_destroyed").notNull(),
    timestamp: timestamp("timestamp").defaultNow(),
  },
  (table) => ({
    levelIdx: index("rounds_level_id_idx").on(table.levelId),
    playerIdx: index("rounds_player_id_idx").on(table.playerId),
  })
);

const soloRounds = pgTable(
  "OuiTank-solo_rounds",
  {
    id: serial("id").primaryKey(),
    // ANALYTICS: solo-round history outlives the player (nullable → set null).
    playerId: integer("player_id").references(() => players.id, {
      onDelete: "set null",
    }), // Optional
    levelId: integer("level_id")
      .notNull()
      // Deleting a level removes its solo-round records (NOT NULL → cascade).
      .references(() => levels.id, { onDelete: "cascade" }),
    success: boolean("success").notNull(), // true = won, false = failed
    timeMs: integer("time_ms").notNull(), // Round duration in milliseconds
    kills: integer("kills").notNull(),
    deaths: integer("deaths").notNull(),
    shots: integer("shots").notNull(),
    hits: integer("hits").notNull(),
    plants: integer("plants").notNull(),
    blocksDestroyed: integer("blocks_destroyed").notNull(),
    timestamp: timestamp("timestamp").defaultNow(),
  },
  (table) => ({
    levelIdx: index("solo_rounds_level_id_idx").on(table.levelId),
    playerIdx: index("solo_rounds_player_id_idx").on(table.playerId),
  })
);

module.exports = { ratings, logings, rounds, soloRounds };
