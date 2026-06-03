# syntax=docker/dockerfile:1

# OuiTank — single-image build for the per-PR preview environments (Coolify).
#
# The API server already serves apps/web/dist (server.ts), so one container is
# enough: it bundles the built web client AND runs the Express/Socket.io server,
# front + API + websocket all on the same origin. Paired with
# docker-compose.preview.yml, which adds an ephemeral Postgres. See PREVIEW.md.

FROM node:24-slim

# Skip Husky's git hooks install during `pnpm install` (no .git in the image,
# and hooks are useless at build time).
ENV HUSKY=0

# pnpm via corepack, pinned by the root package.json "packageManager" field.
RUN corepack enable
WORKDIR /app

# Install dependencies first for better layer caching. Copy every workspace
# manifest so `--frozen-lockfile` sees the full dependency graph.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/config-ts/package.json packages/config-ts/
RUN pnpm install --frozen-lockfile

# Copy the rest of the sources.
COPY . .

# Build the isomorphic runtime, then the web client pinned to SAME-ORIGIN URLs
# (the client otherwise hard-codes prod — see apps/web/src/api/client.ts and
# contexts/SocketContext.tsx). Same-origin means one image works for ANY preview
# URL with zero CORS/CSP changes: the front talks to its own host.
ENV VITE_API_URL=/api
ENV VITE_SOCKET_URL=/
RUN pnpm --filter @ouigame/shared build \
  && pnpm --filter @ouigame/web build

ENV NODE_ENV=production
EXPOSE 8000

# Sync the schema onto the fresh preview DB with `push` (not `migrate`:
# migration 0000 assumes a pre-existing DB, the same reason the Jest setup uses
# push), then start the server. drizzle-kit reads the DB_* vars via
# drizzle.config.js.
CMD ["sh", "-c", "pnpm exec drizzle-kit push --force && pnpm exec tsx apps/api/server.ts"]
