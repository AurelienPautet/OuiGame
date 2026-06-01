// Canonical fixed-timestep constants shared by every host of the simulation
// (the authoritative server loop and the client's solo loop). The simulation is
// advanced in fixed slices of `SIM_STEP_S` seconds so behaviour is deterministic
// and completely decoupled from the host's frame rate ("Fix Your Timestep").
//
// Convention used across the runtime:
//   - CONTINUOUS state (positions) is integrated with a real delta time in
//     SECONDS: `position += velocity * dt`, with velocities expressed in px/s.
//   - DISCRETE per-step counters (mytick, mine fuse `timealive`, bot AI
//     intervals, render blink) are counted in fixed simulation TICKS. Under a
//     fixed timestep one tick is exactly `SIM_STEP_S` seconds, so counting ticks
//     is itself a stable unit of time — this is idiomatic for fixed-step sims.

// Simulation rate. One step represents 1/60 s of game time.
export const SIM_HZ = 60;

// The fixed delta time, in seconds, handed to `update(dt)` for one step. This is
// the `dt` every continuous integrator multiplies its velocity by.
export const SIM_STEP_S = 1 / SIM_HZ;

// Same step expressed in milliseconds, for the wall-clock accumulators that
// drive the loops.
export const SIM_STEP_MS = 1000 / SIM_HZ;

// Upper bound on simulation steps run for a single rendered frame. Guards
// against the "spiral of death": if a frame takes very long, we run at most this
// many catch-up steps and drop the remaining backlog instead of falling further
// behind every frame.
export const MAX_SUBSTEPS = 5;

// Any wall-clock gap larger than this (ms) is clamped before being fed to the
// accumulator (e.g. a backgrounded tab or a debugger pause), so the sim never
// tries to fast-forward minutes of real time at once.
export const MAX_FRAME_MS = 250;

// Render-side interpolation delay (ms) used by the online client: snapshots are
// displayed this far in the past so there are always two server states to
// interpolate between, hiding network jitter. ~2 server ticks.
export const INTERP_DELAY_MS = 100;
