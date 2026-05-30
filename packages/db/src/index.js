// @ouigame/db — the Drizzle schema + the configured Postgres connection.
// Plain CommonJS so the (still-JS) apps/api can `require("@ouigame/db")`
// directly with no build step; drizzle-kit reads the schema source directly
// (see drizzle.config.js). Preserves the exact `{ db, pool, schema }` shape the
// old apps/api/db/index.js exported, so consumers only change the specifier.
const { db, pool } = require("./connection");
const schema = require("./schema");

module.exports = { db, pool, schema };
