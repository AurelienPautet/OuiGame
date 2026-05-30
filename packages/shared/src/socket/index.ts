// Socket.io typed event maps for OuiGame. Event STRING names are VERBATIM,
// including the typo "recieve_json_from_id" and the hyphenated/snake_case mix.
// POSITIONAL (multi-arg) events are multi-parameter signatures, NOT single
// objects — that matches Socket.io's variadic emit/on. Single-arg events take
// one parameter; no-arg events take ().
//
// Authored from the OBSERVED wire (the JS server is not yet typed against these),
// so a later server change can silently drift these types until apps/api adopts
// them in a future phase. That is the accepted Phase 1b boundary.
import type {
  RoomSnapshot,
  TickSounds,
  LevelChange,
  PositionAngleEvent,
  PositionEvent,
  WinnerPayload,
  PlayerKillPayload,
  CountdownStartPayload,
} from "../types";
// The level DTOs double as the "level_change_info" / "recieve_json_from_id"
// socket payloads, so they live in api/ (the plan's home for response DTOs).
import type { LevelDTO, LevelInfoDTO, ReceiveJsonFromId } from "../api";

// Client -> Server. "authenticate" carries a bare string (the session token).
// "play" and "new-room" are POSITIONAL multi-arg events.
export interface ClientToServerEvents {
  authenticate: (token: string) => void;
  deauthenticate: () => void;
  get_json_from_id: (level_id: number | string) => void;
  "new-room": (
    name: string,
    rounds: number,
    list_id: number[],
    creator: string
  ) => void;
  play: (
    playerName: string,
    turretc: string,
    bodyc: string,
    room_id: number
  ) => void;
  quit: () => void;
  // "tock" — the ~60fps player input. Keys verbatim: serverid, mysocketid,
  // playerid, direction, plant, click, aim, room_id, mytick.
  tock: (input: {
    serverid: string;
    mysocketid: string;
    playerid: number;
    direction: { x: number; y: number };
    plant: boolean;
    click: boolean;
    aim: { x: number; y: number };
    room_id: number;
    mytick: number;
  }) => void;
}

// Server -> Client. Covers the events the web client consumes plus the
// connect/handshake and gameplay events (including several the client does not
// currently listen to — welcome, socketid, authenticated, error_getting_json,
// wrongserver, room_list — for wire completeness). It is NOT yet exhaustive of
// every server emit: the level-admin events player_stats / rate_success /
// rate_fail (and the legacy save_level_success / save_level_fail) are not
// modelled and must be added before apps/api is typed against this map.
export interface ServerToClientEvents {
  welcome: (msg: string) => void; // literal contains the typo "has joinded the server"
  serverid: (id: string) => void; // 15-char makeid; echoed back in every "tock"
  socketid: (id: string) => void;
  authenticated: (ok: boolean) => void;
  online_count: (count: number) => void;
  // "recieve" typo is the real wire string; payload is null when the level id
  // has no rows (the server emits get_json_from_id's result directly).
  recieve_json_from_id: (level: ReceiveJsonFromId | null) => void;
  error_getting_json: (message: string) => void;
  room_created: (room_id: number) => void;
  // POSITIONAL: (room_id, playerIndex, socketid)
  id: (room_id: number, playerIndex: number, socketid: string) => void;
  "id-fail": () => void;
  "player-connection": (playerName: string) => void;
  your_level_rating: (stars: number | number[]) => void; // number on the play path; client also accepts an array
  level_change: (data: LevelChange) => void;
  // Phase 3 unified the server emit onto the REST getLevel path, so this now
  // carries the full LevelDTO (the solo_* fields are extra constants for online
  // levels; the client only reads element [0]'s id/name/creator/img).
  level_change_info: (levels: LevelDTO[]) => void;
  // recieve_levels / recieve_my_levels: their senders (the old db_level
  // get_levels / get_my_levels) were retired in Phase 3 and are no longer
  // emitted; kept for the historical LevelInfoDTO (solo_*-less) shape.
  recieve_levels: (levels: LevelInfoDTO[]) => void;
  recieve_my_levels: (levels: LevelInfoDTO[]) => void;
  tick: (snapshot: RoomSnapshot) => void;
  tick_sounds: (sounds: TickSounds) => void;
  shoot_explosion: (data: PositionAngleEvent) => void;
  ricochet_explosion: (data: PositionAngleEvent) => void;
  bullet_explosion: (data: PositionEvent) => void;
  player_explosion: (data: PositionEvent) => void;
  mine_explosion: (data: PositionEvent) => void;
  "player-kill": (data: PlayerKillPayload) => void;
  "player-disconnection": (name: string) => void;
  winner: (data: WinnerPayload) => void;
  countdown_start: (data: CountdownStartPayload) => void;
  wrongserver: () => void;
  // POSITIONAL parallel arrays: (room_ids, room_names, room_creator_name,
  // room_players, room_players_max)
  room_list: (
    room_ids: number[],
    room_names: string[],
    room_creator_name: string[],
    room_players: number[],
    room_players_max: number[]
  ) => void;
}
