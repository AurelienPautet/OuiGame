// Broadcasts the online player count: once a minute, and on every
// connect/disconnect. Registered as a SECOND io listener (separate from the
// gameplay handler) — socket.io fires both "connect" and "connection".
import type { AppServer, AppSocket } from "./types";

function registerOnlineCount({ io }: { io: AppServer }) {
  // Log and broadcast player count every minute.
  setInterval(() => {
    const playerCount = io.engine.clientsCount;
    console.log(`[${new Date().toISOString()}] Players online: ${playerCount}`);
    io.emit("online_count", playerCount);
  }, 60000); // 60000ms = 1 minute

  io.on("connection", (socket: AppSocket) => {
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
}

export { registerOnlineCount };
