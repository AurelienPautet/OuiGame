const {
  pgTable,
  serial,
  integer,
  varchar,
  timestamp,
  unique,
  index,
} = require("drizzle-orm/pg-core");
const { players } = require("./players");

// One row per (player, achievement) the player has unlocked. Achievement
// DEFINITIONS live in code (@ouigame/shared/api → ACHIEVEMENTS), keyed by the
// stable string `achievement_key`; this table is purely the unlock ledger, so
// adding/retiring achievements never needs a migration. The UNIQUE constraint
// makes unlocking idempotent (insert ... ON CONFLICT DO NOTHING).
const playerAchievements = pgTable(
  "OuiTank-player_achievements",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      // OWNERSHIP: a player's achievements die with the player (mirrors ratings).
      .references(() => players.id, { onDelete: "cascade" }),
    achievementKey: varchar("achievement_key", { length: 50 }).notNull(),
    unlockedAt: timestamp("unlocked_at").defaultNow(),
  },
  (table) => ({
    uniqueUnlock: unique().on(table.playerId, table.achievementKey),
    playerIdx: index("player_achievements_player_id_idx").on(table.playerId),
  })
);

module.exports = { playerAchievements };
