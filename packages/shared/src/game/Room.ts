import { distance, circlesOverlap } from "./check_collision.js";
import { SIM_STEP_S } from "./loop.js";
import { generateBcollision } from "./level_loader.js";
import { MINE_EXPLOSION_RADIUS, MINE_FUSE_TICKS } from "./game_constants.js";
import { Player } from "./Player.js";
import { Bot, type BotKind } from "./Bot.js";
import { AIBot, type AIBotKind } from "./ai/index.js";
import type {
  Vec2,
  RoomIo,
  RoomBroadcastEvent,
  DrawingContext,
} from "./types.js";
import type { ServerToClientEvents } from "../socket";
import type { StatsCounters } from "./Stats.js";
import type { Block } from "./Block.js";
import type { Hole } from "./Hole.js";
import type { CollisionBox } from "./CollisionBox.js";
import type { Bullet } from "./Bullet.js";
import type { Mine } from "./Mine.js";

interface SoundFlags {
  plant: boolean;
  kill: boolean;
  shoot: boolean;
  ricochet: boolean;
  explose: boolean;
}

// Which bot AI a room spawns. "legacy" is the constructor default FOREVER so
// every existing host/test keeps its behaviour; hosts opt into "v2" by setting
// the field before spawn_all_bots (same pattern as room.maxplayernb).
export type BotSystem = "legacy" | "v2";

// Online room lifecycle. "playing" is the constructor default so solo rooms
// and every existing test are untouched; the server holds freshly created
// rooms in "lobby" (countdownActive frozen) until the host starts the match.
export type RoomStatus = "lobby" | "playing";

// "ffa" is the historical every-tank-for-itself online mode; "coop" pits the
// humans against the level's bots (solo-style levels, server-hosted).
export type RoomMode = "ffa" | "coop";

export class Room {
  static next_id = 1;
  // Keyed by AIBotKind (a superset of the legacy BotKind): bot5/bot6 exist
  // only in the v2 system, but their colors live here with the others.
  static bot_colors: Record<AIBotKind, [string, string]> = {
    bot1: ["blue", "blue"],
    bot2: ["green", "green"],
    bot3: ["orange", "orange"],
    bot4: ["red", "red"],
    bot5: ["yellow", "yellow"],
    bot6: ["purple", "purple"],
    bot7: ["dimgray", "dimgray"],
  };

  static getNextId(): number {
    return Room.next_id++;
  }

  id: number;
  password: string;
  io: RoomIo | null;
  name: string;
  waitingrespawn: boolean;
  atleast2: boolean;
  maxplayernb: number;
  levels: number[];
  rounds: number;
  creator: string;
  sounds: SoundFlags;
  levelid: number;
  human_players: string[];
  players: Record<string, Player>;
  ids: string[];
  ids_to_names: Record<string, string>;
  blocks: Block[];
  Bcollision: CollisionBox[];
  bullets: Bullet[];
  mines: Mine[];
  holes: Hole[];
  spawns: Vec2[];
  nbliving: number;
  tick: number;
  timetoeplode: number;
  mines_explsion_radius: number;
  waitingtime: number;
  // Delta time (seconds) of the current fixed simulation step, handed to every
  // entity's continuous integrator. Always SIM_STEP_S under the fixed loop.
  dt: number;
  bot1_spawns: Vec2[];
  bot2_spawns: Vec2[];
  bot3_spawns: Vec2[];
  bot4_spawns: Vec2[];
  bot5_spawns: Vec2[];
  bot6_spawns: Vec2[];
  countdownActive: boolean;
  countdownDuration: number;
  // v2 bot AI opt-in (see BotSystem above) + the seed its per-bot RNGs derive
  // from. Both are plain Room fields, never part of the `tick` broadcast.
  bot_system: BotSystem;
  bot_seed: number;
  // Online lobby/mode state (see RoomStatus/RoomMode above). All defaults keep
  // solo and legacy-online behaviour byte-identical; only the server's
  // create_room/lobby handlers move them.
  status: RoomStatus;
  mode: RoomMode;
  // Socketid of the lobby host (first human to join; server-transferred when
  // they leave). "" until someone joins — meaningful only on server rooms.
  hostid: string;
  // Socketids of host-added FFA bots, in add order. Read by the v2 brain's
  // allegiance helpers: members are enemies of everyone, allies of nobody.
  lobby_bots: string[];
  // Monotonic id counter for lobby bots; NEVER reset (an id is never reused,
  // even after the bot it named was removed).
  lobby_bot_counter: number;
  // Populated by loadlevel(): the flat level grid the collision pass reads.
  blocklist: number[];
  // Legacy field read by the web solo end-screen; never set by the runtime
  // (always undefined), kept so that read stays type-safe.
  grid_id?: unknown;

  constructor(
    name: string,
    rounds: number,
    levels: number[],
    creator: string,
    io: unknown = null,
    password = ""
  ) {
    this.id = Room.getNextId();
    this.password = password;
    // The runtime only ever calls io.to(id).emit(event, data); both the real
    // Socket.io Server (server) and the web's solo LocalIO satisfy that shape,
    // so the param is accepted loosely and narrowed to RoomIo here.
    this.io = io as RoomIo | null;
    this.name = name;
    this.waitingrespawn = false;
    this.atleast2 = false;
    this.maxplayernb = 0;
    this.levels = levels;
    this.rounds = rounds;
    this.creator = creator;
    this.sounds = {
      plant: false,
      kill: false,
      shoot: false,
      ricochet: false,
      explose: false,
    };
    this.levelid = 0;
    this.human_players = [];
    this.players = {};
    this.ids = [];
    this.ids_to_names = {};
    this.blocks = [];
    this.Bcollision = [];
    this.bullets = [];
    this.mines = [];
    this.holes = [];
    this.spawns = [];
    this.nbliving = 0;
    this.tick = 0;
    this.timetoeplode = MINE_FUSE_TICKS;
    this.mines_explsion_radius = MINE_EXPLOSION_RADIUS;
    this.waitingtime = 5000;
    this.dt = SIM_STEP_S;
    this.bot1_spawns = [];
    this.bot2_spawns = [];
    this.bot3_spawns = [];
    this.bot4_spawns = [];
    this.bot5_spawns = [];
    this.bot6_spawns = [];
    this.blocklist = [];

    // Countdown state - when true, render but skip player input/actions
    this.countdownActive = false;
    this.countdownDuration = 3000; // 3 seconds

    this.bot_system = "legacy";
    // Random by default (games should vary); tests pin it for reproducible
    // bot behaviour. Per-bot streams are derived per socketid, see AIBot.
    this.bot_seed = (Math.random() * 0x7fffffff) | 0;

    this.status = "playing";
    this.mode = "ffa";
    this.hostid = "";
    this.lobby_bots = [];
    this.lobby_bot_counter = 0;
  }

  // Humans still present in the room. human_players historically accumulated
  // stale ids (delete_player never pruned it — fixed now, but count defensively
  // anyway): only ids that still resolve in `players` count.
  human_count(): number {
    let n = 0;
    for (const id of this.human_players) {
      if (this.players[id]) n++;
    }
    return n;
  }

  spawn_new_player(
    playerName: string,
    turretc: string,
    bodyc: string,
    socketid: string
  ): void {
    console.log(
      "Spawning new player:",
      playerName,
      "with socket ID:",
      socketid
    );

    const new_player = new Player(
      { x: 0, y: 0 },
      socketid,
      playerName,
      turretc,
      bodyc
    );
    this.spawn_new(new_player, socketid, this.spawns);
    this.human_players.push(socketid);
  }

  spawn_new(player: Player, socket_id: string, spawns: Vec2[]): void {
    this.players[socket_id] = player;
    this.ids.push(socket_id);
    this.ids_to_names[socket_id] = player.name;
    this.spawn_player(player, spawns);
  }

  spawn_player(player: Player, spawns: Vec2[]): void {
    const spawnid = Math.floor(Math.random() * spawns.length);
    //console.log("caca:", this.spawns, "at spawn id:", this.spawns[spawnid]);

    this.nbliving += 1;
    player.spawn(spawns[spawnid]!);

    spawns.splice(spawnid, 1);
  }

  // `skipIds` lets a caller suppress specific bots by socketid while keeping the
  // numbering of the rest intact. Campaign retries pass the enemies already
  // defeated on the level so they stay dead across a lost life. bot_index is
  // still advanced for skipped slots, so a surviving bot keeps the same id it
  // had on the first attempt (ids are positional, not affected by who is gone).
  spawn_all_bots(skipIds: Set<string> = new Set()): void {
    console.log(
      "Spawning bots in room:",
      this.bot1_spawns,
      this.bot1_spawns.length
    );
    // One config-driven loop replacing the former Bot1-4 subclasses. Per-kind
    // tuning lives in BOT_CONFIGS (Bot.js) / ai/archetypes.ts; colours stay
    // sourced from Room.bot_colors. Preserves the exact socketid numbering: a
    // single bot_index across all kinds, spawn key === the bot's socketid
    // (bot1's old `bot${i}` key already equalled `bot${bot_index}`).
    // bot7 has NO level cell — it is only ever added via spawn_lobby_bot — so
    // it stays out of the `kinds` iteration; its Record entries below are the
    // compile-forced (exhaustive-Record) placeholders.
    const kinds: AIBotKind[] = ["bot1", "bot2", "bot3", "bot4", "bot5", "bot6"];
    const labels: Record<AIBotKind, string> = {
      bot1: "Bot1",
      bot2: "Bot2",
      bot3: "Bot3",
      bot4: "Bot4",
      bot5: "Bot5",
      bot6: "Bot6",
      bot7: "Bot7",
    };
    const spawnLists: Record<AIBotKind, Vec2[]> = {
      bot1: this.bot1_spawns,
      bot2: this.bot2_spawns,
      bot3: this.bot3_spawns,
      bot4: this.bot4_spawns,
      bot5: this.bot5_spawns,
      bot6: this.bot6_spawns,
      bot7: [],
    };
    let bot_index = 0;
    for (const kind of kinds) {
      const spawns = spawnLists[kind];
      const colors = Room.bot_colors[kind];
      // Capture the count BEFORE the loop: spawn_player mutates the spawns array
      // (consumes the used spawn), so reading spawns.length live would stop
      // early. This matches the legacy `number_to_spawn_N` captured-length loops.
      const count = spawns.length;
      for (let i = 0; i < count; i++) {
        const botId = `bot${bot_index}`;
        bot_index++;
        // Already defeated this run: don't respawn it (but a spawn slot is left
        // unused, which is harmless — surviving bots still pick a random spawn).
        if (skipIds.has(botId)) continue;
        // Identical ids/names/colors/spawn flow for both systems — only the
        // class (i.e. the brain) differs, so campaign skipIds, the renderer's
        // `socketId.includes("bot")` check and the kill feed see no change.
        const label = `${labels[kind]}_ ${i}`;
        let bot: Player;
        if (this.bot_system === "v2") {
          bot = new AIBot(
            { x: 0, y: 0 },
            botId,
            label,
            colors[0],
            colors[1],
            kind,
            this.bot_seed
          );
        } else {
          // bot5/bot6 have no legacy brain. Skipping them entirely would make
          // a Miner/Hunter-only level UNWINNABLE under the ?bots=legacy escape
          // hatch (the solo win check requires at least one initial enemy), so
          // spawn a legacy stand-in driven by the mobile bot2 config — keeping
          // the authored name/colour and the positional id (bot_index already
          // advanced, so ids match the v2 layout for campaign skipIds).
          // bot7 can't actually occur here (it is not in the kinds array);
          // the arm only satisfies the AIBotKind→BotKind narrowing.
          const legacyKind: BotKind =
            kind === "bot5" || kind === "bot6" || kind === "bot7"
              ? "bot2"
              : kind;
          bot = new Bot(
            { x: 0, y: 0 },
            botId,
            label,
            colors[0],
            colors[1],
            legacyKind
          );
        }
        this.spawn_new(bot, botId, spawns);
      }
    }
  }

  // Host "Add bot": one player-equal v2 combatant (kind bot7) on a PLAYER
  // spawn slot, exactly like a human joiner. Returns null when no player spawn
  // is free (the join gate normally prevents that). The id is disjoint from
  // both level-bot ids (bot<N>) and socket ids, never reused after a removal,
  // and still contains "bot" so the deployed renderer's `includes("bot")`
  // styling applies unchanged.
  spawn_lobby_bot(): AIBot | null {
    if (this.spawns.length === 0) return null;
    const botId = `lobbybot_${this.lobby_bot_counter}`;
    const name = `Bot ${this.lobby_bot_counter + 1}`;
    this.lobby_bot_counter++;
    const colors = Room.bot_colors.bot7;
    const bot = new AIBot(
      { x: 0, y: 0 },
      botId,
      name,
      colors[0],
      colors[1],
      "bot7",
      this.bot_seed
    );
    this.spawn_new(bot, botId, this.spawns);
    this.lobby_bots.push(botId);
    return bot;
  }

  // delete_player minus the side effects that are wrong for bookkeeping
  // removals: no "player-disconnection" broadcast (a removed bot is not a
  // disconnect toast) and no nbliving<=0 auto-respawn (callers run inside
  // their own respawn sequencing). `return_spawn` gives the slot back to the
  // player pool — true for a host removing a lobby bot, false for the coop
  // round-end cleanup (a level bot's spawnpos came from botN_spawns; pushing
  // it into `spawns` would leak a bot cell into the human pool).
  remove_player_quiet(socketid: string, return_spawn: boolean): void {
    const player = this.players[socketid];
    if (!player) return;
    delete this.players[socketid];
    const idIdx = this.ids.indexOf(socketid);
    if (idIdx !== -1) this.ids.splice(idIdx, 1);
    delete this.ids_to_names[socketid];
    const lobbyIdx = this.lobby_bots.indexOf(socketid);
    if (lobbyIdx !== -1) this.lobby_bots.splice(lobbyIdx, 1);
    const humanIdx = this.human_players.indexOf(socketid);
    if (humanIdx !== -1) this.human_players.splice(humanIdx, 1);
    if (return_spawn && !player.pending_spawn) {
      this.spawns.push(player.spawnpos);
    }
    if (player.alive) {
      this.nbliving--;
    }
  }

  // A human joining a coop room MID-ROUND: registered everywhere (so the
  // scoreboard, lobby panel and tick snapshot know them) but kept off the
  // field — alive=false, no spawn slot consumed, nbliving untouched. The next
  // respawn_the_room() spawns them like everyone else (spawn() clears
  // pending_spawn). Parked off-canvas so clients drawing dead tanks render
  // nothing visible.
  add_waiting_player(
    playerName: string,
    turretc: string,
    bodyc: string,
    socketid: string
  ): void {
    const player = new Player(
      { x: -100, y: -100 },
      socketid,
      playerName,
      turretc,
      bodyc
    );
    player.alive = false;
    player.pending_spawn = true;
    this.players[socketid] = player;
    this.ids.push(socketid);
    this.ids_to_names[socketid] = playerName;
    this.human_players.push(socketid);
  }

  // Top up `spawns` to `needed` slots from walkable floor cells, for coop
  // rooms playing solo levels (typically authored with ONE player spawn).
  // Deterministic — no RNG: multi-source BFS from every code-3 anchor cell in
  // row-major order, fixed N/E/S/W neighbour order, so teammates spawn
  // clustered ring-by-ring around the level's intended start. Walkable floor =
  // codes 0 (empty) and 10 (destroyed wall); traversal additionally passes
  // through code-3 cells (the anchors themselves are floor). Cells already
  // promised — a pooled spawn or any player's spawnpos — are skipped.
  // Exhausting the search (pathological sealed level) returns silently with
  // however many slots were found.
  ensure_spawn_capacity(needed: number): void {
    let missing = needed - this.spawns.length;
    if (missing <= 0) return;

    const COLS = 23;
    const ROWS = 16;
    const cellOf = (v: Vec2): number => (v.y / 50) * COLS + v.x / 50;

    const occupied = new Set<number>();
    for (const s of this.spawns) occupied.add(cellOf(s));
    for (const socketid in this.players) {
      const p = this.players[socketid];
      if (p) occupied.add(cellOf(p.spawnpos));
    }

    const queue: number[] = [];
    const seen = new Set<number>();
    for (let i = 0; i < this.blocklist.length; i++) {
      if (this.blocklist[i] === 3) {
        queue.push(i);
        seen.add(i);
      }
    }

    let head = 0;
    while (head < queue.length && missing > 0) {
      const idx = queue[head]!;
      head++;
      const row = Math.floor(idx / COLS);
      const col = idx % COLS;

      const code = this.blocklist[idx];
      if ((code === 0 || code === 10) && !occupied.has(idx)) {
        this.spawns.push({ x: col * 50, y: row * 50 });
        occupied.add(idx);
        missing--;
      }

      // N, E, S, W — inside the border ring only (rows 1..14, cols 1..21,
      // matching the chassis clamps), through floor/anchor cells only.
      const neighbours = [
        [row - 1, col],
        [row, col + 1],
        [row + 1, col],
        [row, col - 1],
      ] as const;
      for (const [r, c] of neighbours) {
        if (r < 1 || r > ROWS - 2 || c < 1 || c > COLS - 2) continue;
        const nIdx = r * COLS + c;
        if (seen.has(nIdx)) continue;
        const nCode = this.blocklist[nIdx];
        if (nCode !== 0 && nCode !== 10 && nCode !== 3) continue;
        seen.add(nIdx);
        queue.push(nIdx);
      }
    }
  }

  update(dt: number, ctx?: DrawingContext, debug_visual?: boolean): boolean {
    this.sounds = {
      plant: false,
      kill: false,
      shoot: false,
      ricochet: false,
      explose: false,
    };
    this.tick++;
    this.dt = dt;
    //console.log("Updating room:", this.name, "tick:", this.tick);
    this.update_bullets();
    this.update_mines();

    // Only update player movements/actions if not in countdown
    if (!this.countdownActive) {
      this.update_players(ctx, debug_visual);
    }
    //console.log(this.players);
    this.emit_to_room("tick", {
      players: this.players,
      bullets: this.bullets,
      mines: this.mines,
      name: this.name,
      holes: this.holes,
      tick: this.tick,
    });
    this.emit_to_room("tick_sounds", this.sounds);

    return this.check_for_winns_and_load_next_level();
  }

  // Broadcasts a single server->client event to this room. The event name is
  // constrained to the runtime's RoomBroadcastEvent set and the payload to the
  // exact shape `ServerToClientEvents` declares for it, so a typo or a wrong
  // payload is now a compile error rather than silently drifting from the wire.
  emit_to_room<E extends RoomBroadcastEvent>(
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): void {
    if (this.io != null) {
      // Socket.io rooms are string-keyed and players join via
      // `socket.join(String(room.id))`, so broadcast to the string id too —
      // `io.to(<number>)` would target a different (empty) room and silently
      // drop every tick / explosion / sound, leaving clients with no tanks.
      this.io.to(String(this.id)).emit(event, ...args);
    } else {
      //console.error("No io instance available to emit to this:", this.name);
    }
  }

  check_for_winns_and_load_next_level(): boolean {
    // A held lobby can never end a round: nobody can act while frozen, ≥2
    // players idling pre-start must not trip the FFA winner, and a coop room
    // has no bots before Start (an empty bot set would read as instant win).
    if (this.status === "lobby") return false;

    if (this.mode === "coop") {
      if (this.waitingrespawn) return false;
      let alive_humans = 0;
      let alive_bots = 0;
      for (const socketid in this.players) {
        const p = this.players[socketid];
        if (!p || !p.alive) continue;
        if (p.is_bot) alive_bots++;
        else alive_humans++;
      }
      // Humans first: a mutual wipe-out (last human and last bot dying on the
      // same tick) counts as a LOSS. No ≥2-players requirement — one human vs
      // the level's bots is a legal coop round.
      if (alive_humans === 0) {
        this.emit_to_room("winner", {
          socketid: -1,
          waitingtime: this.waitingtime,
          player_scores: this.get_all_player_stats(),
          ids_to_name: this.ids_to_names,
          coop: "loss",
        });
        this.waitingrespawn = true;
        return true;
      }
      if (alive_bots === 0) {
        // Every surviving human wins. The payload's single socketid carries
        // the first of them so old clients still render a sensible "X wins";
        // new clients read the additive `coop` verdict instead.
        let first_alive: string | number = -1;
        for (const socketid in this.players) {
          const p = this.players[socketid];
          if (p && p.alive && !p.is_bot) {
            p.round_stats.stats.wins++;
            if (first_alive === -1) first_alive = socketid;
          }
        }
        this.emit_to_room("winner", {
          socketid: first_alive,
          waitingtime: this.waitingtime,
          player_scores: this.get_all_player_stats(),
          ids_to_name: this.ids_to_names,
          coop: "win",
        });
        this.waitingrespawn = true;
        return true;
      }
      return false;
    }

    if (this.waitingrespawn == false && this.nbliving <= 1) {
      if (Object.keys(this.players).length >= 2) {
        if (this.nbliving == 1) {
          for (const socketid in this.players) {
            const player = this.players[socketid];
            if (player && player.alive) {
              player.round_stats.stats.wins++;
              this.emit_to_room("winner", {
                socketid: socketid,
                waitingtime: this.waitingtime,
                player_scores: this.get_all_player_stats(),
                ids_to_name: this.ids_to_names,
              });
            }
          }
        } else {
          this.emit_to_room("winner", {
            socketid: -1,
            waitingtime: this.waitingtime,
            player_scores: this.get_all_player_stats(),
            ids_to_name: this.ids_to_names,
          });
        }
        this.waitingrespawn = true;
        return true;
      }
    }
    return false;
  }

  delete_player(socketid: string): void {
    const player = this.players[socketid];
    if (player) {
      this.emit_to_room("player-disconnection", player.name);
      delete this.players[socketid];
      this.ids.splice(this.ids.indexOf(socketid), 1);
      delete this.ids_to_names[socketid];
      // Keep the membership lists honest (human_players historically
      // accumulated stale ids forever) so human_count()/host transfer work.
      const humanIdx = this.human_players.indexOf(socketid);
      if (humanIdx !== -1) this.human_players.splice(humanIdx, 1);
      const lobbyIdx = this.lobby_bots.indexOf(socketid);
      if (lobbyIdx !== -1) this.lobby_bots.splice(lobbyIdx, 1);
      // A waiting coop joiner never owned a spawn slot — returning their
      // parked {-100,-100} spawnpos would poison the pool.
      if (!player.pending_spawn) {
        this.spawns.push(player.spawnpos);
      }
      if (player.alive) {
        this.nbliving--;
      }
      // Skip the auto-respawn while a round-end respawn is already pending:
      // the last alive player quitting during the 5s scoreboard wait used to
      // trigger a second, immediate respawn racing the scheduled one.
      if (this.nbliving <= 0 && !this.waitingrespawn) {
        this.respawn_the_room();
      }
    }
  }

  respawn_the_room(): void {
    this.bullets = [];
    this.mines = [];
    this.emit_to_room("level_change", {
      blocks: this.blocks,
      Bcollision: this.Bcollision,
      // Non-null: a live room always has a current level id at this index.
      level_id: this.levels[this.levelid]!,
    });
    for (const socketid in this.players) {
      const player = this.players[socketid];
      if (!player) continue;
      this.spawn_player(player, this.spawns);
    }
    this.nbliving = Object.keys(this.players).length;
    this.waitingrespawn = false;

    if (this.levelid < this.levels.length - 1) {
      this.levelid++;
    } else {
      this.levelid = 0;
    }
  }

  update_players(ctx?: DrawingContext, debug_visual?: boolean): void {
    //console.log("Updating players in room:", this.players);
    for (const sckid in this.players) {
      const player = this.players[sckid];
      if (!player) continue;
      player.update(this, this.dt, ctx, debug_visual);
    }
  }

  update_bullets(): void {
    bulleting: for (let i = 0; i < this.bullets.length; i++) {
      this.bullets[i]!.update(this, this.dt);
      if (this.bullets[i]!.bounce >= this.bullets[i]!.max_bounce) {
        this.emit_to_room("bullet_explosion", {
          position: {
            x: this.bullets[i]!.position.x,
            y: this.bullets[i]!.position.y,
          },
        });
        this.bullets[i]!.emitter.bulletcount--;
        this.bullets.splice(i, 1);
        i -= 1;
        continue bulleting;
      }
      for (let e = 0; e < this.mines.length; e++) {
        // mine.position is the mine's centre; the bullet's circle is taken about
        // its box centre (position + size/2) with its inscribed radius.
        if (
          circlesOverlap(
            this.mines[e]!.position.x,
            this.mines[e]!.position.y,
            this.mines[e]!.radius,
            this.bullets[i]!.position.x + this.bullets[i]!.size.w / 2,
            this.bullets[i]!.position.y + this.bullets[i]!.size.h / 2,
            Math.min(this.bullets[i]!.size.w, this.bullets[i]!.size.h) / 2
          )
        ) {
          this.mines[e]!.timealive = this.timetoeplode;
          this.bullets[i]!.emitter.bulletcount--;
          this.bullets[i]!.emitter.round_stats.stats.hits++;
          this.bullets.splice(i, 1);
          i -= 1;
          continue bulleting;
        }
      }
      for (let e = 0; e < this.bullets.length; e++) {
        // Two bullets collide as their on-screen discs (centre = box centre,
        // radius = inscribed half-size).
        if (
          i != e &&
          circlesOverlap(
            this.bullets[i]!.position.x + this.bullets[i]!.size.w / 2,
            this.bullets[i]!.position.y + this.bullets[i]!.size.h / 2,
            Math.min(this.bullets[i]!.size.w, this.bullets[i]!.size.h) / 2,
            this.bullets[e]!.position.x + this.bullets[e]!.size.w / 2,
            this.bullets[e]!.position.y + this.bullets[e]!.size.h / 2,
            Math.min(this.bullets[e]!.size.w, this.bullets[e]!.size.h) / 2
          )
        ) {
          this.bullets[i]!.emitter.bulletcount--;
          this.bullets[i]!.emitter.round_stats.stats.hits++;
          this.bullets[e]!.emitter.bulletcount--;
          this.bullets[e]!.emitter.round_stats.stats.hits++;
          this.emit_to_room("bullet_explosion", {
            position: {
              x: this.bullets[i]!.position.x,
              y: this.bullets[i]!.position.y,
            },
          });
          if (e < i) {
            this.bullets.splice(i, 1);
            this.bullets.splice(e, 1);
            i -= 2;
          } else {
            this.bullets.splice(e, 1);
            this.bullets.splice(i, 1);
            i -= 1;
          }

          continue bulleting;
        }
      }
      for (const socketid in this.players) {
        const target = this.players[socketid];
        if (!target) continue;
        if (target.BulletCollision(this.bullets[i]!) && target.alive) {
          this.bullets[i]!.emitter.bulletcount--;
          this.bullets[i]!.emitter.round_stats.stats.hits++;

          this.kill(this.bullets[i]!.emitter, target, "bullet");
          this.bullets.splice(i, 1);
          i -= 1;

          continue bulleting;
        }
      }
    }
  }
  update_mines(): void {
    //update the mines
    mining: for (let i = 0; i < this.mines.length; i++) {
      this.mines[i]!.update();
      if (this.mines[i]!.timealive > this.timetoeplode) {
        for (let m = 0; m < this.blocks.length; m++) {
          if (this.blocks[m]!.type == 2) {
            if (
              distance(
                this.mines[i]!.position,
                { w: this.mines[i]!.radius * 2, h: this.mines[i]!.radius * 2 },
                this.blocks[m]!.position,
                this.blocks[m]!.size
              ) <=
              this.mines_explsion_radius ** 2
            ) {
              this.mines[i]!.emitter.round_stats.stats.blocks_destroyed++;
              this.blocklist[
                (this.blocks[m]!.position.y / 50) * 23 +
                  this.blocks[m]!.position.x / 50
              ] = 10;
              generateBcollision(this);
              this.blocks.splice(m, 1);
              this.emit_to_room("level_change", {
                blocks: this.blocks,
                Bcollision: this.Bcollision,
                // Non-null: a live room always has a current level id at this index.
                level_id: this.levels[this.levelid]!,
              });

              m -= 1;
            }
          }
        }
        for (let e = 0; e < this.mines.length; e++) {
          if (
            distance(
              this.mines[i]!.position,
              { w: this.mines[i]!.radius * 2, h: this.mines[i]!.radius * 2 },
              this.mines[e]!.position,
              { w: this.mines[e]!.radius * 2, h: this.mines[e]!.radius * 2 }
            ) <=
            this.mines_explsion_radius ** 2
          ) {
            this.mines[e]!.timealive = this.timetoeplode;
          }
        }
        for (const socketid in this.players) {
          const target = this.players[socketid];
          if (!target) continue;
          if (
            distance(
              this.mines[i]!.position,
              { w: this.mines[i]!.radius * 2, h: this.mines[i]!.radius * 2 },
              target.position,
              target.size
            ) <=
              this.mines_explsion_radius ** 2 &&
            target.alive
          ) {
            this.kill(this.mines[i]!.emitter, target, "mine");
          }
        }

        this.emit_to_room("mine_explosion", {
          position: {
            x: this.mines[i]!.position.x + this.mines[i]!.radius / 2,
            y: this.mines[i]!.position.y + this.mines[i]!.radius / 2,
          },
        });
        this.sounds.explose = true;
        this.mines[i]!.emitter.minecount--;
        this.mines.splice(i, 1);
        i -= 1;
        continue mining;
      }
    }
  }
  kill(killer: Player, killed: Player, type: "bullet" | "mine"): void {
    killed.alive = false;
    killer.round_stats.stats.kills++;
    killed.round_stats.stats.deaths++;
    this.nbliving--;
    this.sounds.kill = true;
    this.emit_to_room("player-kill", {
      players: [killer.name, killed.name],
      type: type,
    });
    this.emit_to_room("player_explosion", {
      position: {
        x: killed.position.x + killed.size.w / 2,
        y: killed.position.y + killed.size.h / 2,
      },
    });
  }

  get_all_player_stats(): Record<string, StatsCounters> {
    const stats: Record<string, StatsCounters> = {};
    for (const socketid in this.players) {
      const player = this.players[socketid];
      if (!player) continue;
      stats[socketid] = player.round_stats.stats;
    }
    return stats;
  }
}
