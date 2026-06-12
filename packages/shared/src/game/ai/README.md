# Bot AI v2

The bot brain that powers solo/campaign enemies. It shares **nothing** with the
legacy AI (`../Bot.ts`, `../possible_moves.ts`, `../possible_shots_balls.ts` —
untouched, still selectable); it drives the same `Player` chassis through the
same Bullet/Mine/Room simulation.

## Selecting a system

`Room.bot_system: "legacy" | "v2"` (constructor default `"legacy"` — hosts opt
in before `spawn_all_bots()`). The web client sets it from
`apps/web/src/lib/botSystem.ts`: URL `?bots=v2|legacy` (either side of the
hash) > localStorage `bot_system` > default (`v2`). `?bots=legacy` is the
permanent escape hatch. `Room.bot_seed` (+ per-socketid FNV hash) seeds every
brain's RNG — pin it for reproducible games (see the determinism test).

## Architecture (one tick)

```
AIBot.update(room, dt, ctx?, dbg?)             every fixed 60 Hz tick
 ├─ brainTick()                                brain.ts — decisions BEFORE the
 │   ├─ refreshPerTick(room)                   chassis moves (bullets update
 │   │    room_state.ts: WeakMap<Room, state>  first, so dodges see this tick)
 │   │    grid rebuild on geometry change, BFS flow fields (flow.ts),
 │   │    human velocity EMAs
 │   ├─ senseThreats()                         perception.ts: bullet CPA
 │   │    (+post-ricochet continuations), fuse-weighted mine danger
 │   ├─ think() every thinkPeriod (staggered)  FSM → intent → steering solve →
 │   │    targeting refresh → mine policy
 │   ├─ micro-aim + turret slew                targeting.ts: re-lead each tick
 │   ├─ fire control                           quality/cooldown/reaction gates,
 │   │                                         1 revalidation cast at commit
 │   └─ debug overlay (Shift in-game)          debug.ts
 └─ super.update(room, dt)                     Player chassis integration
```

- **grid.ts** — Amanatides & Woo DDA over the 23×16 tile grid with r-offset
  reflection planes (exactly the Minkowski geometry `Bullet.ts` sweeps).
  Corner grazes are _flagged and rejected_, never modelled. The golden test
  (`__tests__/ai/grid.test.ts`) pins the DDA polyline to a real stepped Bullet
  within 1.5 px — if physics and model ever diverge, that test fails.
- **targeting.ts** — intercept quadratic (true leading), analytic 1-bounce
  mirror unfolding (lead _through_ the bounce), golden-angle rotating fan for
  2-bounce discovery, cached solutions revalidated at fire commit, ordered
  friendly/self/mine path vetoes (friendly fire is real in this engine).
- **steering.ts** — 8-way context steering (matches the chassis' sign-only
  movement) with danger maps, wall probes, separation and hysteresis.
- **brain.ts** — FSM: IDLE / WANDER / HUNT (flow descent) / ENGAGE (range
  band + strafe) / EVADE / POST_MINE. Mine policy: chokepoint plants,
  flee-drops when pursued, type-2 wall **breaching**, with hard self/teammate
  safety gates (sims pin zero own-mine deaths).

## Archetypes (archetypes.ts — tuning lives HERE, not in code)

| kind        | cell | role                                                           |
| ----------- | ---- | -------------------------------------------------------------- |
| bot1 blue   | 11   | stationary ricochet sentry, forgiving                          |
| bot2 green  | 12   | aggressive presser, light mines                                |
| bot3 orange | 13   | kiting sniper (600 px/s direct), strong dodge, breaches        |
| bot4 red    | 14   | stationary ricochet master, full lead, deadly                  |
| bot5 yellow | 15   | **Miner** — no gun, fast, mine-obsessed (v2 only)              |
| bot6 purple | 16   | **Hunter** — fastest, 5-bullet magazine, corners you (v2 only) |

Under `legacy`, cells 15/16 spawn nothing but still advance the bot id counter
(campaign `skipIds` parity across systems).

## Constraints to respect when changing anything here

- **Wire safety**: all AI state lives behind `#private` fields on `AIBot`; the
  only enumerable field beyond `Player` is `kind`
  (`__tests__/ai/aibot-serialization.test.ts` pins it). Never `structuredClone`
  players — #private state and the prototype would be silently dropped.
- **Determinism**: brains draw ONLY from their seeded `Rng` — `Math.random` is
  forbidden in `ai/` (the determinism test catches violations).
- **No legacy imports**: `ai/` must never import `Bot.ts` /
  `possible_moves.ts` / `possible_shots_balls.ts` (type-only `Room`/`BotKind`
  imports are fine).
- **Zero steady-state allocation**: scratch buffers are module-level; the sim
  is single-threaded and never reentrant.
- **Tuning loop**: change numbers in `archetypes.ts`, then run
  `pnpm exec vitest run packages/shared/src/game/__tests__/ai/` — the
  capability gates in `aibot-behavior.test.ts` (TTK, dodge survival, maze
  navigation, mine safety) are the regression net.
