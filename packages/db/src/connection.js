const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");
const schema = require("./schema");

// The connection string + SSL behaviour are env-driven. This package does NOT
// load dotenv: env is the consumer's responsibility (apps/api's server.js loads
// the root .env before requiring this, drizzle.config.js loads dotenv/config,
// and the jest setup sets DB_* directly). Loading dotenv here would need a
// brittle relative path to the repo root that only makes sense for one consumer.
const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const pool = new Pool({
  connectionString,
  // Heroku Postgres presents a self-signed certificate, so verification is
  // disabled in that environment (the standard Heroku workaround). Set
  // DB_SSL_STRICT=true once a CA bundle is configured to enforce verification.
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: process.env.DB_SSL_STRICT === "true" }
    : undefined,
});

pool.on("connect", () => {
  console.log("Connected to PostgreSQL database via Drizzle");
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

const db = drizzle(pool, { schema });

module.exports = { db, pool };
