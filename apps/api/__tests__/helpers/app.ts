// Builds a minimal Express app that mounts the API router exactly the way
// server.js does (`app.use("/api", apiRoutes)` followed by the central error
// handler), but without the socket.io server, rate limiter, static file
// serving, or process-wide side effects. This lets supertest exercise the real
// route handlers and real DB queries. The error handler MUST be mounted last,
// like in server.ts, so routes that throw HttpError map to their status/body
// instead of falling through to Express's default 500.
import express from "express";
import apiRoutes from "../../routes";
import { errorHandler } from "../../middleware/error.middleware";

function buildApp() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use("/api", apiRoutes);
  app.use(errorHandler);
  return app;
}

export { buildApp };
