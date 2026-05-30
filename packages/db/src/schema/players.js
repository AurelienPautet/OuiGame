const {
  pgTable,
  serial,
  varchar,
  timestamp,
  integer,
  check,
} = require("drizzle-orm/pg-core");
const { sql } = require("drizzle-orm");

const players = pgTable(
  "OuiTank-players",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 30 }).notNull().unique(),
    email: varchar("email", { length: 60 }).notNull().unique(),
    type: varchar("type", { length: 10 }).notNull(),
    passwordHash: varchar("password_hash", { length: 250 }),
    googleId: varchar("google_id", { length: 500 }),
    creationTimestamp: timestamp("creation_timestamp").defaultNow(),
  },
  (table) => ({
    correctAuth: check(
      "correct_auth",
      sql`
    (${table.type} = 'google' AND ${table.googleId} IS NOT NULL) OR
    (${table.type} = 'db' AND ${table.passwordHash} IS NOT NULL)
  `
    ),
  })
);

const playerSessions = pgTable("OuiTank-player_sessions", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .notNull()
    // OWNERSHIP: a session is meaningless without its player.
    .references(() => players.id, { onDelete: "cascade" }),
  sessionToken: varchar("session_token", { length: 120 }).notNull().unique(),
  expirationTimestamp: timestamp("expiration_timestamp").default(
    sql`NOW() + INTERVAL '7 days'`
  ),
});

module.exports = { players, playerSessions };
