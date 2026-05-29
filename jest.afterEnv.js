// setupFilesAfterEnv: runs once per test FILE. We close the shared Postgres
// pool after each file so Jest exits without open handles — but only if that
// file actually loaded Server/db. Pure unit tests (collision, commons) never
// touch the database and must not be forced to construct a connection pool, so
// we look the module up in the require cache instead of requiring it here.
const dbModulePath = require.resolve("./apps/api/db");

afterAll(async () => {
  const cached = require.cache[dbModulePath];
  if (cached && cached.exports && cached.exports.pool) {
    await cached.exports.pool.end();
  }
});
