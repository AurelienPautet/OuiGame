# OuiTank web client — architecture

`apps/web` is the React + TypeScript client of the OuiTank monorepo. The guiding
principle is unchanged from the original game: **React owns the UI (menus,
modals, HUD, editors); the game runs in a separate, imperative engine driven by
`requestAnimationFrame`** and talking to the server over Socket.io. React and the
engine are bridged by a single `useRef` in `GameCanvas`.

Everything here is TypeScript (`strict`, plus `noUncheckedIndexedAccess` +
`exactOptionalPropertyTypes`). Vite builds and dev-serves it; there is no
separate compile step.

## Place in the monorepo

```
apps/web    ← this package (React 19 + Vite 7 + TanStack Query 5 + DaisyUI/Tailwind v4)
apps/api    ← Express 5 + Socket.io + Drizzle server
packages/shared  ← @ouigame/shared: the isomorphic game runtime (./game) +
                   the typed contracts the client imports:
                     ./api    Zod schemas + inferred REST DTOs
                     ./socket ClientToServerEvents / ServerToClientEvents
                     ./types  shared wire shapes (RoomSnapshot, LevelChange, …)
packages/db      ← Drizzle schema + connection (server-only)
packages/config-ts ← shared tsconfig base
```

The client imports **types** from `@ouigame/shared/{api,socket,types}` and the
game **runtime** (`Room`, `loadlevel`, `makeid`) from `@ouigame/shared/game`.

## Layers

```
┌──────────────────────────── React (UI) ─────────────────────────────┐
│  main.tsx → App.tsx  (providers + always-mounted LandingPage + canvas)│
│                                                                       │
│  contexts/        SocketContext  (one socket.io client, typed)        │
│                   AuthContext    (session / current user)             │
│                   GameContext    (game-mode state machine, campaigns) │
│                   ModalContext   (which overlay is open)              │
│                   ToastContext   (notifications)                      │
│                                                                       │
│  components/ui · modals · landing · game     pages/ (full-screen      │
│  hooks/api/  (TanStack Query, typed vs DTOs)  Level/Campaign editors) │
│  api/  client.ts + endpoints/  (fetch wrapper, Bearer auth)           │
│  lib/storage.ts  (typed localStorage: session, name, tank colours …)  │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │  GameCanvas.tsx  (useRef → engine)
┌───────────────────────────────▼───────────────────────────────────────┐
│                      engine/ (imperative, no React)                    │
│  GameEngine.ts   rAF loop; solo runs a local Room, online listens to   │
│                  the server `tick`; owns the socket gameplay listeners │
│  Renderer.ts     canvas drawing            InputHandler.ts  kbd/mouse  │
│  ParticleSystem.ts  effects               SoundManager.ts  Web Audio   │
└────────────────────────────────────────────────────────────────────────┘
```

## Directory structure

```
apps/web/
├── index.html
├── vite.config.js            base "./" (relative assets — required for itch.io)
├── .env.itch                 VITE_API_URL / VITE_SOCKET_URL for the itch build
├── types/                    ambient .d.ts (the untyped @ouigame/shared/game runtime)
└── src/
    ├── main.tsx · App.tsx
    ├── providers/            QueryProvider, ErrorBoundary
    ├── contexts/             Socket · Auth · Settings · Game · Modal · Toast (+ index barrel)
    ├── api/
    │   ├── client.ts         fetch wrapper; Bearer token from storage; VITE_API_URL
    │   └── endpoints/        auth · settings · levels · campaigns · solo · rankings · rooms · stats
    ├── hooks/api/            TanStack Query hooks (data infers the @ouigame/shared/api DTOs)
    ├── lib/storage.ts        typed localStorage access (settings mirrored to the account when signed in)
    ├── constants/            campaign rules, tank colours
    ├── utils/                level helpers (hex→dataURL, bot extraction)
    ├── components/
    │   ├── ui/               Toast, RoomCard, LevelCard, LevelSelector, Tabs, …
    │   ├── modals/           Auth, Profile, Rankings, RoomSelector, CreateRoom,
    │   │                     LevelSelector, MyLevels, TankSelect, Campaign* …
    │   ├── landing/          LandingPage (always visible behind overlays)
    │   └── game/             GameCanvas (the React↔engine bridge), EndGameScreen, …
    ├── audio/                Tone.js + Tonal: procedural synth voices, tank-driven arrangement, AudioBus
    ├── engine/               GameEngine · Renderer · InputHandler · ParticleSystem · SoundManager
    │                         interpolation.ts (server-timeline clock) · prediction.ts (local tank)
    └── pages/                LevelEditor, CampaignEditor (full-screen, route-based)
```

## Key patterns

- **React ↔ engine bridge.** `GameCanvas` creates a `GameEngine` against the
  canvas refs + the (typed) socket and drives it imperatively; React never
  re-renders per frame. On unmount/quit, `GameEngine.quit()` removes its socket
  listeners and `InputHandler.destroy()` removes the global key/mouse listeners
  (symmetric attach/detach — the next game re-attaches).
- **Typed socket end-to-end.** `SocketContext` holds one
  `Socket<ServerToClientEvents, ClientToServerEvents>`; every `emit`/`on` is
  checked against `@ouigame/shared/socket`.
- **Multiplayer netcode.** The server runs the authoritative `Room` at a fixed
  60 Hz and broadcasts a full snapshot every tick. The client renders other
  players/bullets ~100 ms in the past, but samples the snapshot buffer on the
  **server tick timeline** (`InterpolationClock`), not on packet arrival times,
  so network jitter cannot distort playback speed. Our own tank is **predicted**
  locally with the shared `Player.update` movement code; each `tock` carries a
  monotonic `seq`, the server consumes at most one queued input per simulation
  step and echoes the consumed seq as `player.last_input_seq`, and the client
  rewinds + replays only the unacknowledged inputs on every snapshot. Small
  corrections are smoothed over ~80 ms; respawns/level reloads snap.
- **Data layer.** `api/client.ts` is a small typed fetch wrapper (Bearer token
  from `lib/storage`); `hooks/api/*` wrap it in TanStack Query, with `data`
  inferring the DTOs from `@ouigame/shared/api`.
- **Account-backed settings.** `SettingsContext` keeps localStorage as the
  anonymous source of truth and, for a signed-in player, hydrates the account
  copy on login then mirrors every change (debounced) to `PUT /api/settings`.
  The account wins on login; an empty account is seeded from the local blob.
  The shared Zod schema is the single definition of the blob's shape.
- **Contexts return non-null.** `useGame()/useModal()/useSocket()/…` throw if
  used outside their provider, so consumers don't null-check.
- **Overlay UI, not routes** (except the full-screen editors): `ModalContext`
  tracks which overlay is open over the always-mounted `LandingPage` + canvas.

## Build targets

- `pnpm --filter @ouigame/web build` — the normal production bundle (talks to the
  hosted API/socket via the PROD defaults).
- `pnpm --filter @ouigame/web build:itch` — `vite build --mode itch`; loads
  `.env.itch` so `VITE_API_URL`/`VITE_SOCKET_URL` point the static, cross-origin
  itch.io bundle at the hosted backend (the server already allows the itch
  origins via CORS; auth is a Bearer token in localStorage, which works
  cross-origin). Zip `dist/` and upload to itch.
