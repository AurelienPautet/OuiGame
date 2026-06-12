import type { Room } from "../Room.js";

// Who a v2 bot fights versus protects.
//
// Level bots (solo/campaign/coop, spawned from level cells 11–16) keep the
// historical allegiance: enemies = the humans in `room.human_players`, and
// every other bot is an ally (never shot through, never sacrificed to a mine).
// Lobby bots (host-added free-for-all combatants, tracked in `room.lobby_bots`)
// are everyone's enemy and nobody's ally. The two populations never share a
// room — lobby bots exist only in "ffa" rooms, level bots only in solo/coop —
// so allegiance reduces to one membership test against `room.lobby_bots`.

// Every socketid a bot may target: humans plus lobby bots. With no lobby bots
// this returns `room.human_players` ITSELF (not a copy), so every existing
// solo/campaign code path keeps byte-identical iteration (the golden
// determinism suites pin that). Callers iterating this set must skip the
// asking bot's own socketid.
//
// NOTE for hot paths: this allocates when lobby bots exist. The per-tick code
// goes through syncTargetIds + AIRoomState.targets instead (zero steady-state
// allocation, ai/'s pinned discipline); this form stays for cold callers and
// tests.
export function targetIds(room: Room): readonly string[] {
  if (room.lobby_bots.length === 0) return room.human_players;
  return [...room.human_players, ...room.lobby_bots];
}

// Allocation-free mirror of targetIds for the per-tick path: keeps `out`
// equal to humans ++ lobby bots, rebuilding in place ONLY when membership
// actually changed (joins/leaves/bot add+remove — rare events).
export function syncTargetIds(out: string[], room: Room): void {
  const hp = room.human_players;
  const lb = room.lobby_bots;
  let dirty = out.length !== hp.length + lb.length;
  for (let i = 0; i < hp.length && !dirty; i++) dirty = out[i] !== hp[i];
  for (let i = 0; i < lb.length && !dirty; i++) {
    dirty = out[hp.length + i] !== lb[i];
  }
  if (!dirty) return;
  out.length = 0;
  for (const id of hp) out.push(id);
  for (const id of lb) out.push(id);
}

// A bot the shooter must protect: the friendly-fire shot veto and the mine
// teammate gate call this. Matches the legacy `socketid.includes("bot")`
// convention for level bots; lobby bots are fair game for everyone. The
// lobby_bots scan only runs in rooms that actually have lobby bots.
export function isProtectedBot(room: Room, socketid: string): boolean {
  if (!socketid.includes("bot")) return false;
  return room.lobby_bots.length === 0 || !room.lobby_bots.includes(socketid);
}
