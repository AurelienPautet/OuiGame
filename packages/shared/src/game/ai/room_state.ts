import { TILE } from "./constants.js";
import { AIGrid } from "./grid.js";
import { FlowField } from "./flow.js";
import { targetIds } from "./allegiance.js";
import type { Room } from "../Room.js";
import type { CollisionBox } from "../CollisionBox.js";

// Room-shared AI working state, kept OUTSIDE the Room instance (WeakMap) so
// nothing here can ever leak into the `tick` broadcast or hold a dead room
// alive. The first bot ticking each frame refreshes it; the rest just read.

const FLOW_PERIOD_TICKS = 15;
const VEL_EMA_ALPHA = 0.2; // per-tick smoothing of human velocity for leading

export class AIRoomState {
  grid = new AIGrid();
  // One flow field per live human socketid (chase = downhill, flee = uphill).
  flows = new Map<string, FlowField>();
  // Smoothed velocities so a juking player doesn't whip every lead point.
  velEMA = new Map<string, { vx: number; vy: number }>();
  lastBcollision: CollisionBox[] | null = null;
  lastBlocklist: number[] | null = null;
  lastRefreshTick = -1;
  lastFlowTick = -1e9;
}

const states = new WeakMap<Room, AIRoomState>();

export function getAIRoomState(room: Room): AIRoomState {
  let s = states.get(room);
  if (!s) {
    s = new AIRoomState();
    states.set(room, s);
  }
  return s;
}

// Idempotent per tick (every AIBot calls it; only the first does work).
export function refreshPerTick(room: Room, s: AIRoomState): void {
  if (s.lastRefreshTick === room.tick) return;
  s.lastRefreshTick = room.tick;

  // generateBcollision assigns a NEW array on every level load and wall
  // breach, so identity comparison is a free, reliable rebuild trigger.
  const geomChanged =
    room.Bcollision !== s.lastBcollision || room.blocklist !== s.lastBlocklist;
  if (geomChanged) {
    s.grid.rebuild(room.blocklist);
    s.lastBcollision = room.Bcollision;
    s.lastBlocklist = room.blocklist;
  }

  // Velocity EMAs and flow fields exist for every targetable tank — humans
  // plus lobby bots — so bots can lead and chase each other in FFA rooms.
  const targets = targetIds(room);
  for (const id of targets) {
    const p = room.players[id];
    if (!p || !p.alive) continue;
    let e = s.velEMA.get(id);
    if (!e) {
      e = { vx: 0, vy: 0 };
      s.velEMA.set(id, e);
    }
    e.vx += VEL_EMA_ALPHA * (p.velocity.x - e.vx);
    e.vy += VEL_EMA_ALPHA * (p.velocity.y - e.vy);
  }

  if (geomChanged || room.tick - s.lastFlowTick >= FLOW_PERIOD_TICKS) {
    s.lastFlowTick = room.tick;
    for (const id of targets) {
      const p = room.players[id];
      if (!p || !p.alive || p.position == undefined) continue;
      let f = s.flows.get(id);
      if (!f) {
        f = new FlowField();
        s.flows.set(id, f);
      }
      f.compute(
        s.grid,
        Math.floor((p.position.x + p.size.w / 2) / TILE),
        Math.floor((p.position.y + p.size.h / 2) / TILE)
      );
    }
  }
}
