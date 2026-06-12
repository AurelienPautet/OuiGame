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
export function targetIds(room: Room): readonly string[] {
  if (room.lobby_bots.length === 0) return room.human_players;
  return [...room.human_players, ...room.lobby_bots];
}

// A bot the shooter must protect: the friendly-fire shot veto and the mine
// teammate gate call this. Matches the legacy `socketid.includes("bot")`
// convention for level bots; lobby bots are fair game for everyone.
export function isProtectedBot(room: Room, socketid: string): boolean {
  return socketid.includes("bot") && !room.lobby_bots.includes(socketid);
}
