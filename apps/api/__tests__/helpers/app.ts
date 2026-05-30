// Builds a minimal Express app that mounts the API router exactly the way
// server.js does (`app.use("/api", apiRoutes)`), but without the socket.io
// server, rate limiter, static file serving, or process-wide side effects.
// This lets supertest exercise the real route handlers and real DB queries.
import express from "express";
import apiRoutes from "../../routes";

function buildApp() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/api", apiRoutes);
  return app;
}

export { buildApp };
