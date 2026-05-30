// setupFilesAfterEnv: runs once per test FILE. We close the shared Postgres
// pool after each file so Jest exits without open handles — but only if that
// file actually loaded @ouigame/db. Pure unit tests (collision, commons) never
// touch the database and must not be forced to construct a connection pool, so
// we look the module up in the require cache instead of requiring it here.
// Resolve @ouigame/db the way the test files do (from apps/api) so the cache
// key matches.
const path = require("path");
const dbModulePath = require.resolve("@ouigame/db", {
  paths: [path.join(__dirname, "apps/api")],
});

afterAll(async () => {
  const cached = require.cache[dbModulePath];
  if (cached && cached.exports && cached.exports.pool) {
    await cached.exports.pool.end();
  }
});
