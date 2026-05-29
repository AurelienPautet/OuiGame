// setupFiles: runs in each worker BEFORE any test module (and therefore before
// Server/db is required), so the DB_* env vars point at the test database by
// the time the connection pool is created.
const { applyTestEnv } = require("./Server/__tests__/helpers/testEnv");
applyTestEnv();
