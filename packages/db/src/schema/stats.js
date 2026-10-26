const {
  pgTable,
  serial,
  integer,
  varchar,
  timestamp,
  date,
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
    // ANALYTICS: round duration, recorded from the tick loop's round clock.
    // Nullable because rounds inserted before this column existed have no
    // duration (they must not be misread as zero-length rounds).
    durationMs: integer("duration_ms"),
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

// One row per logged-in socket "play session" (connect → disconnect, with a
// short reconnect grace so a page refresh does not split a session). This is
// total time in the game, including menus and lobby — distinct from the
// per-round durations in `rounds` / `solo_rounds`.
const playSessions = pgTable(
  "OuiTank-play_sessions",
  {
    id: serial("id").primaryKey(),
    // ANALYTICS: session history outlives the player (nullable → set null).
    playerId: integer("player_id").references(() => players.id, {
      onDelete: "set null",
    }),
    startedAt: timestamp("started_at").notNull(),
    endedAt: timestamp("ended_at").notNull(),
    durationMs: integer("duration_ms").notNull(),
  },
  (table) => ({
    playerIdx: index("play_sessions_player_id_idx").on(table.playerId),
  })
);

// One row per unique visitor per UTC day: the daily-active-user metric. A
// visitor is a logged-in player (`p:<playerId>`) or a guest browser
// (`c:<clientId>`, generated and persisted client-side). Rows are upserted by
// the socket connection handler; `playerId` is filled in when a guest
// authenticates during the same day. Keeping the raw visitor key (rather than
// only a counter) makes the metric idempotent across reconnects and lets the
// admin dashboard break the total down into registered vs guest users.
const dailyActiveUsers = pgTable(
  "OuiTank-daily_active_users",
  {
    id: serial("id").primaryKey(),
    // UTC calendar day, stored as a date so the admin bucket key is stable.
    day: date("day").notNull(),
    // Visitor identity for the day: "p:<playerId>" or "c:<clientId>".
    visitorKey: varchar("visitor_key", { length: 80 }).notNull(),
    // Null for guests. ON DELETE SET NULL keeps the historical metric when an
    // account is removed (the visit still happened).
    playerId: integer("player_id").references(() => players.id, {
      onDelete: "set null",
    }),
    firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueVisitorDay: unique().on(table.day, table.visitorKey),
    dayIdx: index("daily_active_users_day_idx").on(table.day),
    playerIdx: index("daily_active_users_player_id_idx").on(table.playerId),
  })
);

module.exports = {
  ratings,
  logings,
  rounds,
  soloRounds,
  playSessions,
  dailyActiveUsers,
};
