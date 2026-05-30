# Backend tests

Jest test suite for the Express/Drizzle backend.

## Running

```bash
pnpm test            # run once
pnpm test:watch      # watch mode
```

## What's covered

- **`unit/`** — pure functions from the `@ouigame/shared/game` package, no
  database (these double as a smoke test that its CJS build is require-able):
  - `commons.test.js` — `makeid` token generator
  - `collision.test.js` — the geometry helpers (`check_collision`)
- **`middleware/`** — `authMiddleware` / `optionalAuth` (token validation, expiry).
- **`routes/`** — every API router exercised end-to-end with `supertest` against a
  real Postgres database: `auth`, `levels`, `rankings`, `stats`, `solo`, `rooms`.

The `/google` auth endpoint mocks `verifyToken` so no real Google OAuth is needed.

## Database

Tests run against a **dedicated `ouigame_test` database** — never the dev
`ouigame` database. Requirements:

- The local Docker Postgres must be running (host port `5433`, user/password
  `ouigame`, same as dev).

`jest.globalSetup.js` runs once before the suite and:

1. Creates the `ouigame_test` database if it doesn't exist.
2. Applies the current Drizzle schema with `drizzle-kit push`.

`push` is used instead of `migrate` because migration `0000` backs up legacy
tables (`CREATE TABLE ... AS SELECT * FROM players`) that don't exist in a fresh
database. `push` diffs the schema straight onto the empty database.

Each test file calls `cleanDb()` in `beforeEach` to `TRUNCATE ... RESTART
IDENTITY` all tables, so tests are isolated and order-independent. Test files run
serially (`maxWorkers: 1`) since they share the one test database.

### Overriding connection settings

The defaults match local dev. Override via env vars if needed:
`TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USER`, `TEST_DB_PASSWORD`,
`TEST_DB_NAME`, `TEST_DB_ADMIN_DB` (the database used to issue `CREATE DATABASE`).

## Helpers

- `helpers/app.js` — builds the Express app (mounts `/api` routes) without
  socket.io / rate limiting / static serving.
- `helpers/db.js` — `cleanDb()` plus fixture builders (`createPlayer`,
  `createUserWithSession`, `createLevel`, `createRound`, `createSoloRound`).
- `helpers/testEnv.js` — centralizes the test DB environment.
