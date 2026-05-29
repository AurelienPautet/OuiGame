// Runs once before the whole test suite (in its own process).
//
// 1. Drops and recreates the dedicated test database for a clean, deterministic
//    schema (no leftover columns/tables from a previously checked-out branch).
// 2. Applies the current Drizzle schema to it via `drizzle-kit push`.
//
// We use `push` rather than `migrate` on purpose: migration 0000 backs up
// legacy tables (CREATE TABLE ... AS SELECT * FROM players) which do not exist
// in a fresh database, so `migrate` would fail. `push` diffs the schema
// straight onto the freshly-created empty database.
//
// This runs once per `jest` invocation (including the start of a --watch
// session), not per test file, so the drop/recreate cost is paid once.

const { Client } = require("pg");
const { execFileSync } = require("child_process");
const path = require("path");
const {
  applyTestEnv,
  adminConnectionConfig,
  testDbName,
} = require("./apps/api/__tests__/helpers/testEnv");

async function recreateTestDatabase() {
  const name = testDbName();
  // Database identifiers can't be parameterized, so validate before
  // interpolating into destructive DROP/CREATE statements: require a plain
  // identifier that ends in `_test`. This blocks SQL injection via quotes and,
  // just as importantly, prevents ever dropping a non-test database.
  if (!/^[A-Za-z_][A-Za-z0-9_]*_test$/.test(name)) {
    throw new Error(
      `Refusing to (re)create database "${name}": the test database name must ` +
        `be a plain identifier ending in "_test".`
    );
  }
  const client = new Client(adminConnectionConfig());
  await client.connect();
  try {
    // Terminate any lingering connections so DROP DATABASE can proceed.
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
         WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [name]
    );
    // Database names cannot be parameterized; `name` is developer/CI-controlled.
    await client.query(`DROP DATABASE IF EXISTS "${name}"`);
    await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }
}

function pushSchema() {
  // drizzle.config.js reads DB_* env vars (DATABASE_URL is blocked by
  // applyTestEnv), so the push targets the freshly-created test database.
  // --force is safe here: the database is empty, so there is nothing to lose.
  execFileSync("npx", ["drizzle-kit", "push", "--force"], {
    cwd: path.join(__dirname),
    env: process.env,
    stdio: "inherit",
  });
}

module.exports = async () => {
  applyTestEnv();
  await recreateTestDatabase();
  pushSchema();
};
