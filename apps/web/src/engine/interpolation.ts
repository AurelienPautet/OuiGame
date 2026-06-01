// Pure interpolation helpers for the display loop. The simulation runs at a
// fixed rate (see @ouigame/shared/game loop constants); rendering happens at the
// display refresh rate and interpolates between the two most recent simulation
// states so motion stays perfectly smooth and decoupled from the sim rate.
//
// Everything here is side-effect free so it can be unit tested in isolation.

/** Linear interpolation between `a` and `b` by `t` in [0,1]. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp `v` into the inclusive range [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Interpolate between two angles (radians) along the shortest arc, so a tank or
 * bullet spinning across the ±π wrap never does a full backwards spin.
 */
export function lerpAngle(a: number, b: number, t: number): number {
  // Shortest signed delta in (-π, π].
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * t;
}

/** A render pose: position plus optional facing/orientation angles. */
export interface Pose {
  x: number;
  y: number;
  angle?: number;
  rotation?: number;
}

/** Interpolate a full pose (position lerp + shortest-arc angle lerp). */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
  if (a.angle !== undefined && b.angle !== undefined) {
    out.angle = lerpAngle(a.angle, b.angle, t);
  } else if (b.angle !== undefined) {
    out.angle = b.angle;
  }
  if (a.rotation !== undefined && b.rotation !== undefined) {
    out.rotation = lerp(a.rotation, b.rotation, t);
  } else if (b.rotation !== undefined) {
    out.rotation = b.rotation;
  }
  return out;
}

/** Anything with a position and (optionally) facing angles we can interpolate. */
export interface Posable {
  position: { x: number; y: number };
  angle?: number;
  rotation?: number;
}

/** Read the render pose out of a positioned entity. */
export function poseOf(e: Posable): Pose {
  const pose: Pose = { x: e.position.x, y: e.position.y };
  if (e.angle !== undefined) pose.angle = e.angle;
  if (e.rotation !== undefined) pose.rotation = e.rotation;
  return pose;
}

/**
 * Shallow-clone an entity, overriding its position/angle with an interpolated
 * pose. Every other field (size, colour, alive, type, …) is carried through
 * unchanged so the renderer sees a complete entity that simply sits at the
 * interpolated spot.
 */
export function withPose<T extends Posable>(e: T, pose: Pose): T {
  const out = { ...e, position: { x: pose.x, y: pose.y } } as T;
  if (pose.angle !== undefined) out.angle = pose.angle;
  if (pose.rotation !== undefined) out.rotation = pose.rotation;
  return out;
}

/** A simulation/server state stamped with the wall-clock time it represents. */
export interface TimedFrame<S> {
  t: number;
  state: S;
}

/**
 * Pick the two buffered frames that straddle `renderTime` and the blend factor
 * between them, for entity interpolation of an online stream. The buffer must be
 * ordered by ascending `t`.
 *
 * - Empty buffer → null.
 * - `renderTime` before the oldest frame → that frame, alpha 0 (we never
 *   extrapolate backwards).
 * - `renderTime` at/after the newest frame → the newest frame, alpha 0 (hold the
 *   latest known state rather than extrapolate into the future).
 */
export function sampleBuffer<S>(
  buffer: TimedFrame<S>[],
  renderTime: number
): { a: TimedFrame<S>; b: TimedFrame<S>; alpha: number } | null {
  if (buffer.length === 0) return null;
  const first = buffer[0]!;
  if (renderTime <= first.t) return { a: first, b: first, alpha: 0 };

  for (let i = buffer.length - 1; i >= 0; i--) {
    const a = buffer[i]!;
    if (a.t <= renderTime) {
      const b = buffer[i + 1] ?? a;
      const span = b.t - a.t;
      const alpha = span > 0 ? clamp((renderTime - a.t) / span, 0, 1) : 0;
      return { a, b, alpha };
    }
  }
  // Unreachable (renderTime > first.t guaranteed a match), but stay total.
  return { a: first, b: first, alpha: 0 };
}

/**
 * Drop frames older than `cutoff` from the front of an ascending-time buffer,
 * keeping at least the most recent frame so there is always something to show.
 */
export function pruneBuffer<S>(buffer: TimedFrame<S>[], cutoff: number): void {
  while (buffer.length > 1 && buffer[0]!.t < cutoff) {
    buffer.shift();
  }
}
