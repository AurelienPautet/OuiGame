// MUST be first: loads the root .env before @ouigame/db (imported transitively
// below) creates its connection pool at import time. See env.ts.
import "./env";

import path from "path";
import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@ouigame/shared/socket";
import { makeid } from "@ouigame/shared/game";

import apiRoutes from "./routes";
import type { SocketData } from "./socket/types";
import { createRoomRegistry } from "./game/roomRegistry";
import { createTickLoop } from "./game/tickLoop";
import { registerSocketHandlers } from "./socket/handlers";
import { registerOnlineCount } from "./socket/onlineCount";

const app = express();

// Behind Heroku's router; trust the first proxy hop so req.ip and the rate
// limiter key on the real client IP rather than the shared proxy IP.
app.set("trust proxy", 1);

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

app.use(express.static(path.join(import.meta.dirname, "../web/dist")));

app.get("/*splat", limiter, (_req: Request, res: Response) => {
  res.sendFile(path.join(import.meta.dirname, "../web/dist/index.html"));
});

const PORT = process.env.PORT || 8000;
const expressServer = app.listen(PORT);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>(expressServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

// --- Socket + game composition root ---
// makeid is only needed here for the per-process server id; the game runtime
// (Room/loadlevel) and the data layer live inside the modules below.
const serverid = makeid(15);

// roomRegistry owns the `rooms` object (and shares it with the HTTP routes via
// setRoomsRef); the tick loop and socket handlers receive it by reference.
const registry = createRoomRegistry({ io, serverid });
const tickLoop = createTickLoop({
  io,
  rooms: registry.rooms,
  roomTimers: registry.roomTimers,
});

registerSocketHandlers({
  io,
  serverid,
  rooms: registry.rooms,
  room_list: registry.room_list,
  create_room: registry.create_room,
  deleteRoomIfEmpty: registry.deleteRoomIfEmpty,
});
registerOnlineCount({ io });

tickLoop.start();
