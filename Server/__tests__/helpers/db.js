// Test database helpers: reset state between tests and seed fixtures directly
// through Drizzle (faster and more explicit than going through the HTTP API).
const bcrypt = require("bcryptjs");
const { getTableConfig } = require("drizzle-orm/pg-core");
const { db, schema, pool } = require("../../db");
const { makeid } = require("../../../shared/scripts/commons.js");
const { hashToken } = require("../../auth/session");

const {
  players,
  playerSessions,
  levels,
  levelsImg,
  ratings,
  logings,
  rounds,
  soloRounds,
} = schema;

// Derive the physical table names from the schema itself so adding/renaming a
// table can never silently leave it out of the truncate set (which would leak
// rows across test files). Order does not matter because of CASCADE.
const ALL_TABLES = Object.values(schema)
  .map((table) => {
    try {
      return `"${getTableConfig(table).name}"`;
    } catch {
      return null; // non-table export, if any
    }
  })
  .filter(Boolean);

// Defense in depth: even though applyTestEnv() points DB_NAME at the test
// database, refuse to run a destructive TRUNCATE unless we're actually
// connected to a `*_test` database matching DB_NAME. This guards against a
// misconfigured environment ever pointing tests at real data.
let testDbVerified = false;
async function assertTestDatabase() {
  if (testDbVerified) return;
  const { rows } = await pool.query("SELECT current_database() AS db");
  const current = rows[0] && rows[0].db;
  const expected = process.env.DB_NAME;
  if (!current || current !== expected || !/_test$/.test(current)) {
    throw new Error(
      `Refusing to truncate database "${current}": expected a *_test database ` +
        `matching DB_NAME="${expected}". Check that DATABASE_URL is not ` +
        `overriding the test database.`
    );
  }
  testDbVerified = true;
}

async function cleanDb() {
  await assertTestDatabase();
  await pool.query(
    `TRUNCATE TABLE ${ALL_TABLES.join(", ")} RESTART IDENTITY CASCADE`
  );
}

let userCounter = 0;

// Inserts a "db"-type player with a hashed password. Returns the row plus the
// plaintext password used (handy for login tests).
async function createPlayer(overrides = {}) {
  userCounter += 1;
  const password = overrides.password || "password123";
  const passwordHash = await bcrypt.hash(password, 10);
  const values = {
    username: overrides.username || `user${userCounter}`,
    email: overrides.email || `user${userCounter}@example.com`,
    type: "db",
    passwordHash,
    ...overrides,
  };
  delete values.password;
  const [row] = await db.insert(players).values(values).returning();
  return { ...row, password };
}

async function createSession(playerId, token = makeid(120)) {
  // Production persists only the SHA-256 hash of the token (Server/auth/session.js),
  // and the middleware hashes the presented token before lookup. Store the hash
  // so seeded sessions match, but return the raw token for the Authorization header.
  await db
    .insert(playerSessions)
    .values({ playerId, sessionToken: hashToken(token) });
  return token;
}

// Convenience: a player with an active session token ready for Authorization.
async function createUserWithSession(overrides = {}) {
  const player = await createPlayer(overrides);
  const token = await createSession(player.id);
  return { player, token, authHeader: `Bearer ${token}` };
}

async function createLevel(creatorId, overrides = {}) {
  userCounter += 1;
  const values = {
    name: overrides.name || `level${userCounter}`,
    creatorId,
    maxPlayers: overrides.maxPlayers ?? 2,
    type: overrides.type || "online",
    status: overrides.status || "up",
    content: overrides.content ?? { data: [] },
  };
  const [row] = await db.insert(levels).values(values).returning();
  if (overrides.img !== undefined) {
    await db
      .insert(levelsImg)
      .values({ levelId: row.id, img: Buffer.from(overrides.img, "hex") });
  }
  return row;
}

async function createRound(playerId, levelId, overrides = {}) {
  const values = {
    playerId,
    levelId,
    wins: overrides.wins ?? 0,
    kills: overrides.kills ?? 0,
    deaths: overrides.deaths ?? 0,
    shots: overrides.shots ?? 0,
    hits: overrides.hits ?? 0,
    plants: overrides.plants ?? 0,
    blocksDestroyed: overrides.blocksDestroyed ?? 0,
  };
  const [row] = await db.insert(rounds).values(values).returning();
  return row;
}

async function createSoloRound(playerId, levelId, overrides = {}) {
  const values = {
    playerId,
    levelId,
    success: overrides.success ?? true,
    timeMs: overrides.timeMs ?? 1000,
    kills: overrides.kills ?? 0,
    deaths: overrides.deaths ?? 0,
    shots: overrides.shots ?? 0,
    hits: overrides.hits ?? 0,
    plants: overrides.plants ?? 0,
    blocksDestroyed: overrides.blocksDestroyed ?? 0,
  };
  const [row] = await db.insert(soloRounds).values(values).returning();
  return row;
}

module.exports = {
  db,
  schema,
  cleanDb,
  createPlayer,
  createSession,
  createUserWithSession,
  createLevel,
  createRound,
  createSoloRound,
  tables: { ratings, logings },
};
