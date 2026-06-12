import type { Vector2, StatsCounters } from "./primitives";
import type {
  Player,
  Bullet,
  Mine,
  Hole,
  Block,
  CollisonsBox,
} from "./entities";

// The `tick` payload — full instance serialization, emitted every Room.update()
// (~60fps). `players` is a MAP (Record), NOT an array. `name` is present but
// ignored by the web client.
export interface RoomSnapshot {
  players: Record<string, Player>;
  bullets: Bullet[];
  mines: Mine[];
  name: string;
  holes: Hole[];
  tick: number;
}

// The `tick_sounds` payload — per-tick boolean flags emitted right after `tick`.
// The "explose" typo is the REAL key (load-bearing).
export interface TickSounds {
  plant: boolean;
  kill: boolean;
  shoot: boolean;
  ricochet: boolean;
  explose: boolean;
}

// The `level_change` payload. The wire key is "Bcollision" (capital B).
// `level_id` is snake_case. The client reads only `blocks` + `Bcollision`.
export interface LevelChange {
  blocks: Block[];
  Bcollision: CollisonsBox[];
  level_id: number;
}

// Particle/explosion events: shoot_explosion / ricochet_explosion carry an angle.
export interface PositionAngleEvent {
  position: Vector2;
  angle: number;
}

// bullet_explosion / mine_explosion / player_explosion carry only a position.
export interface PositionEvent {
  position: Vector2;
}

// The `winner` payload. `socketid` is -1 (number) for a DRAW. The key
// "ids_to_name" (singular) drops the trailing "s" vs the Room field.
// `coop` is present only on coop-mode rounds: the team verdict ("win" = all
// bots destroyed, "loss" = all humans dead — mutual wipe counts as loss).
// On a coop win `socketid` carries the first surviving human so old clients
// still render a name. FFA rounds omit the key entirely.
export interface WinnerPayload {
  socketid: string | number;
  waitingtime: number;
  player_scores: Record<string, StatsCounters>;
  ids_to_name: Record<string, string>;
  coop?: "win" | "loss";
}

// One row of the `lobby_state` member list (humans and host-added bots, in
// join order). Colors use the same name vocabulary as play/tock.
export interface LobbyMember {
  socketid: string;
  name: string;
  turretc: string;
  bodyc: string;
  is_bot: boolean;
  is_host: boolean;
}

// The `lobby_state` payload — broadcast to a room on every membership/host/
// status change while it sits in the pre-game lobby (never per tick).
// `max_players` is the room's capacity gate: total combatants for "ffa",
// humans only for "coop".
export interface LobbyState {
  room_id: number;
  name: string;
  status: "lobby" | "playing";
  mode: "ffa" | "coop";
  max_players: number;
  members: LobbyMember[];
}

// The `player-kill` payload. `players` is a [killerName, killedName] tuple.
export interface PlayerKillPayload {
  players: [string, string];
  type: "bullet" | "mine";
}

// The `countdown_start` payload (the web handler ignores it).
export interface CountdownStartPayload {
  duration: number;
}
