// Single source of truth for the test database environment, shared by the Jest
// globalSetup process and the per-worker setup files.
//
// IMPORTANT: tests run against a dedicated `*_test` database, never the dev
// `ouigame` database. The connection defaults below match the local Docker
// Postgres and can be overridden per-var (TEST_DB_*) — notably in CI.

const DEFAULTS = {
  host: "localhost",
  port: "5433",
  user: "ouigame",
  password: "ouigame",
  name: "ouigame_test",
  // Database used purely as an entry point to issue CREATE/DROP DATABASE.
  adminDb: "ouigame",
};

function resolved() {
  return {
    host: process.env.TEST_DB_HOST || DEFAULTS.host,
    port: process.env.TEST_DB_PORT || DEFAULTS.port,
    user: process.env.TEST_DB_USER || DEFAULTS.user,
    password: process.env.TEST_DB_PASSWORD || DEFAULTS.password,
    name: process.env.TEST_DB_NAME || DEFAULTS.name,
    adminDb: process.env.TEST_DB_ADMIN_DB || DEFAULTS.adminDb,
  };
}

function applyTestEnv() {
  const r = resolved();

  // Block DATABASE_URL so a developer's .env can never silently retarget the
  // tests at a real database. We set it to an empty string rather than
  // `delete`-ing it: both Server/db/index.js (dotenv.config) and
  // drizzle.config.js (`import "dotenv/config"`) only populate variables that
  // are *unset*, so leaving it present-but-empty prevents a .env DATABASE_URL
  // from being reloaded. Server/db treats "" as falsy and falls back to DB_*.
  process.env.DATABASE_URL = "";

  process.env.DB_HOST = r.host;
  process.env.DB_PORT = r.port;
  process.env.DB_USER = r.user;
  process.env.DB_PASSWORD = r.password;
  process.env.DB_NAME = r.name;

  // auth_server.js constructs an OAuth2Client with this; a dummy value keeps
  // module load from depending on real Google credentials.
  process.env.GOOGLE_CLIENT_ID =
    process.env.GOOGLE_CLIENT_ID || "test-google-client-id";

  process.env.NODE_ENV = "test";
}

function adminConnectionConfig() {
  const r = resolved();
  return {
    host: r.host,
    port: Number(r.port),
    user: r.user,
    password: r.password,
    database: r.adminDb,
  };
}

function testDbName() {
  return resolved().name;
}

module.exports = {
  DEFAULTS,
  applyTestEnv,
  adminConnectionConfig,
  testDbName,
};
