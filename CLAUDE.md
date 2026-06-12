# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

OuiTank (package scope `@ouigame`) — a multiplayer browser tank game. Live at
[wiitank.pautet.net](https://wiitank.pautet.net) (Heroku), with a secondary static
build published to itch.io. pnpm + Turborepo monorepo, Node 24.x, pnpm 10.23.0.

## Monorepo layout

| Package              | Role                                                                                                                                                                                                         | Module system |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| `apps/web`           | React 19 + Vite 7 + TanStack Query 5 + DaisyUI/Tailwind v4 client. TypeScript `strict`. See `apps/web/ARCHITECTURE.md`.                                                                                      | ESM, TS       |
| `apps/api`           | Express 5 + Socket.io + Drizzle server. Run via `tsx` (no build step).                                                                                                                                       | ESM, TS       |
| `packages/shared`    | `@ouigame/shared`: the **isomorphic game runtime** (`./game`) + typed contracts: `./api` (Zod schemas + inferred REST DTOs), `./socket` (event maps), `./types` (wire shapes). Built dual ESM+CJS by `tsup`. | mixed         |
| `packages/db`        | `@ouigame/db`: Drizzle schema + Postgres connection pool. Server-only.                                                                                                                                       | CJS           |
| `packages/config-ts` | Shared tsconfig base.                                                                                                                                                                                        | —             |

Subpath exports of `@ouigame/shared` matter: `./game` and `./api` are **built**
(consumed from `dist/` by CJS/Jest), while `./socket` and `./types` are
**source-only** TS imports. This is why `pnpm test` builds shared first.

## Commands (run from repo root)

```bash
pnpm dev               # turbo: web (:5173) + api (:8000) together
pnpm dev:web           # client only
pnpm dev:api           # server only (tsx watch)
pnpm build             # turbo build all packages
pnpm start             # prod server (tsx apps/api/server.ts; also serves apps/web/dist)

pnpm typecheck         # turbo: tsc --noEmit across packages
pnpm lint              # eslint . + the web package's own eslint
pnpm lint:fix
pnpm format            # prettier --write .   (format:check in CI)

# DB (Drizzle)
pnpm db:generate       # generate a migration from schema changes
pnpm db:migrate
pnpm db:migrate-data   # one-off data migration script
```

### Tests — two runners, split by domain

- **Jest** owns `apps/api/__tests__` — backend integration tests against a **real
  Postgres**. `pnpm test` builds `@ouigame/shared` first, then runs Jest.
  - Run one file/test: `pnpm --filter @ouigame/shared build && pnpm exec jest <path>` or `... jest -t "test name"`.
  - Needs the local Docker Postgres up (host port `5433`, user/pass `ouigame`).
    `jest.globalSetup.js` creates a dedicated **`ouigame_test`** DB (never the dev
    `ouigame` DB) and applies the schema via `drizzle-kit push`. Tests run serially
    (`maxWorkers: 1`); each file `cleanDb()`s (TRUNCATE) in `beforeEach`. Details in
    `apps/api/__tests__/README.md`.
- **Vitest** owns `apps/web` (jsdom) + `packages/shared/src/game` (node) — pure unit tests.
  - `pnpm test:unit` (run) / `pnpm test:unit:watch`.
  - Run one: `pnpm exec vitest run <path or -t "name">`.

## Architecture essentials

**The game runtime is isomorphic and shared.** `@ouigame/shared/game` (`Room`,
`Player`, `Bot`, collision/raycast helpers, `loadlevel`, `makeid`) runs on _both_
sides: the client runs a local `Room` for **solo** play; the server runs the
authoritative `Room` for **online** play and broadcasts a `tick` snapshot. Same
simulation code, two hosts. This runtime is still plain **JS** (with ambient
`.d.ts` shims); everything else is TypeScript.

**Two bot AI systems, selected by `Room.bot_system`.** The default for solo/
campaign is the **v2** brain (`packages/shared/src/game/ai/` — leading, ricochet
planning, context steering, mines; see its README). The legacy AI (`Bot.ts` +
`possible_moves.ts` + `possible_shots_balls.ts`) is frozen by golden tests and
reachable via `?bots=legacy` (or localStorage `bot_system`) — never edit the
legacy files or import them from `ai/`. Bot kinds map to level cells 11–16;
15/16 (Miner/Hunter) exist only under v2.

**Client = React UI + a separate imperative engine.** React owns menus/modals/HUD;
the game itself runs in `apps/web/src/engine/` driven by `requestAnimationFrame`,
never re-rendered by React. The two are bridged by a single `useRef` in
`GameCanvas.tsx`. Full detail in `apps/web/ARCHITECTURE.md`.

**Server composition root** is `apps/api/server.ts`: `createRoomRegistry` owns the
`rooms` object (shared with HTTP routes by reference), `createTickLoop` runs the
~60fps authoritative loop, `registerSocketHandlers` + `registerOnlineCount` wire up
Socket.io. Routes are layered **routes → services → repositories** (see
`apps/api/{routes,services,repositories}`), with Zod request validation middleware.

**`apps/api/env.ts` must be the very first import** in any entrypoint
(`server.ts`, `scripts/*`). ESM hoists imports, and `@ouigame/db` creates its
Postgres pool at import time, so the root `.env` has to load before `@ouigame/db`
is pulled in (directly or transitively). On Heroku the `.env` is absent and real
config vars are already set, so it's a no-op there.

**Typed socket, with verbatim wire strings.** `packages/shared/src/socket/index.ts`
defines `ClientToServerEvents`/`ServerToClientEvents`. Event name strings are the
**real wire**, including historical typos (`recieve_json_from_id`, `recieve_levels`,
`welcome` → "has joinded the server") and a snake_case/hyphen mix. Several events
are **positional multi-arg** (e.g. `room_list`, `id`, `play`, `new-room`), matching
Socket.io's variadic `emit`/`on` — do not "fix" these names or collapse the args.

## Conventions

- **Conventional Commits, scope required.** Enforced by commitlint
  (`scope-empty: never`) on commit-msg and by `pr-title-lint` in CI. e.g.
  `feat(web): …`, `refactor(api): …`, `ci(deploy): …`.
- **Husky + lint-staged** run on pre-commit; commitlint on commit-msg.
- **TS strictness ratchet** (Phase 5): `strict` + `noUncheckedIndexedAccess` +
  `exactOptionalPropertyTypes` + no `any`. New TS should hold this bar.
- ESLint is split: the **root** flat config (`eslint.config.mjs`) covers
  `apps/api`, `packages/shared/src/game`, `packages/db`, and root tooling; the
  **web** package ships its own `apps/web/eslint.config.js`. The root config
  ignores `apps/web`, `dist`, `dist-types`, `migrations`.

## Local database

Local dev expects Docker Postgres on host port **5433** (user/pass/db all
`ouigame`); copy `.env.example` → `.env`. The source of truth for the schema is
the Drizzle schema in `packages/db/src/schema/`. Heroku injects `DATABASE_URL`;
locally the discrete `DB_*` vars are used instead.

## Deploy

CI (`.github/workflows/ci.yml`) runs lint (server + client), typecheck, Jest
backend tests (with a Postgres service), and Vitest unit tests. After CI passes on
`master`, `deploy-itch.yml` builds the itch.io bundle
(`pnpm --filter @ouigame/web build:itch`, using `apps/web/.env.itch`) and pushes it
with butler. The Heroku app is deployed separately.
