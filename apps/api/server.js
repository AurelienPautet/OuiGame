const path = require("path");
// Load .env from the repo root so it works regardless of CWD. Turbo runs this
// script from apps/api/, and dotenv only looks in CWD; on Heroku the file is
// absent and real config vars are already set, so a missing file is a no-op.
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const express = require("express");
const app = express();

// Behind Heroku's router; trust the first proxy hop so req.ip and the rate
// limiter key on the real client IP rather than the shared proxy IP.
app.set("trust proxy", 1);
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const apiRoutes = require("./routes");
const { setRoomsRef } = require("./routes/rooms.routes");
const { verifySession } = require("./auth/session");

// Fail fast if critical configuration is missing rather than crashing later
// with a cryptic error mid-request.
function assertEnv() {
  // The DB connection needs either a full DATABASE_URL (Heroku) or the
  // discrete DB_* vars (local dev).
  const hasDbConfig =
    !!process.env.DATABASE_URL ||
    ["DB_USER", "DB_PASSWORD", "DB_HOST", "DB_PORT", "DB_NAME"].every(
      (k) => process.env[k]
    );
  if (!hasDbConfig) {
    console.error(
      "Missing database configuration: set DATABASE_URL or all of DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME."
    );
    process.exit(1);
  }
  // Google sign-in is optional locally; warn instead of failing so the rest of
  // the app can still run without it.
  if (!process.env.GOOGLE_CLIENT_ID) {
    console.warn("GOOGLE_CLIENT_ID is not set — Google sign-in will not work.");
  }
}
assertEnv();

// Single source of truth for allowed origins. Extra origins can be supplied
// via the CORS_ORIGINS env var (comma-separated) without code changes.
const allowedOrigins = [
  "http://localhost:7000",
  "https://wiitank-2aacc4abc5cb.herokuapp.com",
  "https://wiitank.pautet.net",
  "http://localhost:8000",
  "http://localhost:5173",
  "http://localhost:5174",
  "https://html-classic.itch.zone",
  "https://itch.io",
  ...(process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
    : []),
];

// Security headers. The CSP allows what the served client needs: same-origin
// scripts/styles (the React bundle — the game runtime is bundled in, no longer
// separate <script> tags), the Google Identity script, data:/blob: images
// (level thumbnails are data URLs), and connections to the API/socket + Google.
// Cross-origin resource/embedder policies are relaxed so the itch.io build can
// consume the API cross-origin. (CSP only applies to responses this server
// serves; the itch.io build is served by itch and uses its own headers.)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://accounts.google.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://wiitank.pautet.net",
          "wss://wiitank.pautet.net",
        ],
        frameSrc: ["https://accounts.google.com"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(express.json({ limit: "10mb" }));

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use("/api", limiter, apiRoutes);

app.use(express.static(path.join(__dirname, "../web/dist")));

app.get("/*splat", limiter, (req, res) => {
  res.sendFile(path.join(__dirname, "../web/dist/index.html"));
});

const PORT = process.env.PORT || 8000;
const expressServer = app.listen(PORT);

const socketio = require("socket.io");
const io = socketio(expressServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

const { loadlevel, makeid, Room } = require("@ouigame/shared/game");

const levelsService = require("./services/levels.service");
const levelsRepo = require("./repositories/levels.repo");
const ratingsRepo = require("./repositories/ratings.repo");
const statsRepo = require("./repositories/stats.repo");

// Resolve a session token to an in-memory user record keyed by socket id.
async function authenticateSocket(socket, token) {
  try {
    const user = await verifySession(token);
    if (user) {
      users[socket.id] = {
        playerId: user.playerId,
        username: user.username,
        email: user.email,
      };
      return true;
    }
  } catch (err) {
    console.error("Socket auth error:", err);
  }
  delete users[socket.id];
  return false;
}

io.on("connect", (socket) => {
  room_list(socket);
  socket.join("lobby" + serverid);

  // Authenticate from the token supplied in the handshake (set on initial
  // connect and on every reconnect). This populates `users[socket.id]` so
  // gameplay stats and level ratings are attributed to the logged-in player.
  if (socket.handshake.auth?.token) {
    authenticateSocket(socket, socket.handshake.auth.token);
  }

  // Re-authenticate when the user logs in/out without reconnecting.
  socket.on("authenticate", async (token) => {
    const ok = await authenticateSocket(socket, token);
    socket.emit("authenticated", ok);
  });
  socket.on("deauthenticate", () => {
    delete users[socket.id];
  });

  socket.emit("welcome", socket.id + "has joinded the server");
  socket.emit("serverid", serverid);
  socket.emit("socketid", socket.id);

  socket.on("disconnect", function () {
    disconnect_socket(socket, io);
  });

  socket.on("get_json_from_id", (level_id) => {
    levelsService
      .getLevelJson(level_id)
      .then((json) => {
        if (json === null) {
          socket.emit("error_getting_json", "Failed to retrieve level data.");
          return;
        }
        socket.emit("recieve_json_from_id", json);
      })
      .catch((error) => {
        console.error("Error getting JSON from ID:", error);
        socket.emit("error_getting_json", "Failed to retrieve level data.");
      });
  });

  socket.on("new-room", async (name, rounds, list_id, creator) => {
    const room_id = await create_room(name, 10, list_id, creator, io);
    socket.emit("room_created", room_id);
  });

  socket.on("quit", () => {
    // Just leave the game room, don't logout - user stays authenticated
    leave_game(socket, io);
    socket.join("lobby" + serverid);
  });

  socket.on("play", (playerName, turretc, bodyc, room_id) => {
    const room = rooms[room_id];
    //console.log("play", playerName, turretc, bodyc, room_id, room, rooms);
    if (room == undefined) {
      socket.emit("id-fail");
      return;
    }
    if (
      room.ids.includes(socket.id) == false &&
      Object.keys(room.players).length < room.maxplayernb
    ) {
      //console.log("ouiii mon gars");
      room.spawn_new_player(playerName, turretc, bodyc, socket.id);
      socket.emit("id", room.id, room.ids.length - 1, socket.id);
      socket.leave("lobby" + serverid);
      socket.join(room.id);
      io.to(room.id).emit("player-connection", playerName);
      // level_change_info is emitted as an ARRAY (the client reads levels[0]),
      // exactly as the old format_and_send_levels did — [] when missing.
      levelsService.getLevel(room.levels[room.levelid]).then((level) => {
        socket.emit("level_change_info", level ? [level] : []);
      });

      // Send user's current rating for this level
      if (users[socket.id]) {
        ratingsRepo
          .getRating(
            room.levels[room.levelid], // room.levels holds level IDs
            users[socket.id].playerId
          )
          .then((stars) => {
            socket.emit("your_level_rating", stars ? stars : 0);
          });
      }

      //console.log("blocks on plys", room.blocks);
      socket.emit("level_change", {
        blocks: room.blocks,
        Bcollision: room.Bcollision,
        level_id: room.levels[room.levelid],
      });
      room_list(0);
    } else {
      socket.emit("id-fail");
    }
  });

  socket.on("tock", (data) => {
    if (isFlooding(socket)) return;
    if (!data || typeof data !== "object") return;

    // Compare (not assign) the server id, and only ever act on the player that
    // belongs to *this* socket — never a socket-id supplied in the payload.
    if (data.serverid !== serverid) {
      socket.emit("wrongserver");
      return;
    }

    const room = rooms[data.room_id];
    const player = room?.players?.[socket.id];
    if (!player || player.position == undefined) return;
    if (room.countdownActive) return; // can see, but not act, during countdown

    if (Number.isFinite(data.mytick)) player.mytick = data.mytick;
    if (isVector(data.direction)) player.direction = data.direction;
    if (isVector(data.aim)) player.aim = data.aim;
    if (data.click) player.shoot(room);
    if (data.plant) player.plant(room);
  });
});

// {x, y} with finite numeric components.
function isVector(v) {
  return (
    v != null &&
    typeof v === "object" &&
    Number.isFinite(v.x) &&
    Number.isFinite(v.y)
  );
}

// Lightweight per-socket flood guard. Normal play sends ~60 tock/s; anything
// past MAX_EVENTS_PER_WINDOW is dropped to blunt event spam.
const MAX_EVENTS_PER_WINDOW = 150;
const RATE_WINDOW_MS = 1000;
function isFlooding(socket) {
  const now = performance.now();
  if (!socket._rl || now - socket._rl.start > RATE_WINDOW_MS) {
    socket._rl = { start: now, count: 0 };
  }
  socket._rl.count += 1;
  return socket._rl.count > MAX_EVENTS_PER_WINDOW;
}

const tickTockInterval = setTimeout(function toocking() {
  const func = setTimeout(toocking, 16.67);
  const TimeElapsed = getTimeElapsed();
  const fps_corector = TimeElapsed / 16.67;

  for (const room of Object.values(rooms)) {
    if (room.update(fps_corector)) {
      for (const socketid in room.players) {
        const player = room.players[socketid];
        const playerId = users[socketid] ? users[socketid].playerId : null;
        statsRepo.insertRound(
          playerId,
          room.levels[room.levelid],
          player.round_stats.stats
        );
        player.round_stats.reset();
      }

      const respawnwait = setTimeout(async () => {
        const level_json = await levelsService.getLevelJson(
          room.levels[room.levelid]
        );
        await loadlevel(level_json.data, room);

        levelsService.getLevel(room.levels[room.levelid]).then((level) => {
          room.io.to(room.id).emit("level_change_info", level ? [level] : []);
        });

        room.respawn_the_room();

        // Activate countdown - players can see but not act
        room.countdownActive = true;
        room.io
          .to(room.id)
          .emit("countdown_start", { duration: room.countdownDuration });

        // End countdown after duration
        setTimeout(() => {
          room.countdownActive = false;
        }, room.countdownDuration);

        for (const socketid in room.players) {
          if (users[socketid]) {
            const stars = await ratingsRepo.getRating(
              room.levels[room.levelid].id,
              users[socketid].playerId
            );
            io.to(socketid).emit("your_level_rating", stars ? stars : 0);
          }
        }
      }, waitingtime);
    }
  }
}, 16.67); //16.67 means that this code runs at 60 fps

function room_list(socket) {
  const room_ids = [];
  const room_names = [];
  const room_players = [];
  const room_players_max = [];
  const room_creator_name = [];
  for (const room of Object.values(rooms)) {
    room_ids.push(room.id);
    room_names.push(room.name);
    room_players.push(Object.keys(room.players).length);
    room_players_max.push(room.maxplayernb);
    room_creator_name.push(room.creator);
  }
  ////console.log("room_list");
  if (socket != 0) {
    socket.emit(
      "room_list",
      room_ids,
      room_names,
      room_creator_name,
      room_players,
      room_players_max
    );
  } else {
    io.to("lobby" + serverid).emit(
      "room_list",
      room_ids,
      room_names,
      room_creator_name,
      room_players,
      room_players_max
    );
  }
}

//important constants for the game
const waitingtime = 5000;

let fps_corector_global = 1;
const { users } = require(__dirname + "/shared_state.js");
//Function to get time elapsed in milliseconds between two moments
let oldTime = performance.now();

function getTimeElapsed() {
  const now = performance.now();
  const res = now - oldTime;
  oldTime = now;
  return res;
}

async function create_room(name, rounds, list_id, creator, io) {
  const room = new Room(name, rounds, list_id, creator, io);
  room.maxplayernb = (await levelsRepo.getMinMaxPlayers(list_id)).min;
  const level_json = await levelsService.getLevelJson(
    room.levels[room.levelid]
  );
  //console.log("level_json", level_json);
  rooms[room.id] = room;
  if (room) {
    loadlevel(level_json.data, room);
  }
  room_list(0);
  console.log("Room created:", room.id, room.name);
  return room.id;
  ////console.log(rooms);
}
const rooms = {};

// Share rooms reference with HTTP routes
setRoomsRef(rooms);

//create_room("2 players", 10, [2], "GAME MASTER", io);
/*
setTimeout(() => {
  create_room("6 players", 10, [1], "GAME MASTER", io);
}, 10000); */

function disconnect_socket(socket, io) {
  console.log(socket.id, "Got disconnect!");
  // Drop the in-memory auth record for this socket. The persisted session
  // (HTTP) stays valid so the user remains logged in across reconnects.
  delete users[socket.id];
  // Also leave game room
  leave_game(socket, io);
}

// Leave game room without logging out - called on quit
function leave_game(socket, io) {
  try {
    for (const r of Object.values(rooms)) {
      socket.leave(r.id);
      r.delete_player(socket.id);
    }
  } catch (error) {
    console.error("Error handling player leaving game:", error);
  }
  room_list(0);
}

const serverid = makeid(15);
//console.log(serverid);

// Log and broadcast player count every minute
setInterval(() => {
  const playerCount = io.engine.clientsCount;
  console.log(`[${new Date().toISOString()}] Players online: ${playerCount}`);
  io.emit("online_count", playerCount);
}, 60000); // 60000ms = 1 minute

// Also emit count on new connections/disconnections
io.on("connection", (socket) => {
  // Small delay to let any pending disconnects complete first (handles refresh)
  setImmediate(() => {
    io.emit("online_count", io.engine.clientsCount);
  });
  socket.on("disconnect", () => {
    // Delay to ensure socket is fully removed from count
    setImmediate(() => {
      io.emit("online_count", io.engine.clientsCount);
    });
  });
});
