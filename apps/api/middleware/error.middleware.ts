// The single Express error handler, mounted LAST in server.ts (after every
// route). Express 5 forwards a thrown or rejected async handler here
// automatically, which is what lets the route handlers drop their per-handler
// try/catch -> console.error -> res.status(500) boilerplate.
//
//   - HttpError  -> a deliberate, already-mapped failure: its status + body,
//                   verbatim (preserves each route's existing response shape).
//   - ZodError   -> a validation failure forwarded via next(err); answered with
//                   the same 400 `{ error, details }` shape validate() emits
//                   directly, so a future `next(err)` path stays consistent.
//   - otherwise  -> an unexpected error: logged once, answered with an opaque
//                   500 so no internal detail leaks to the client.
import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { HttpError } from "../errors";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  // If the response already started streaming, defer to Express's default
  // handler, which closes the connection — we can't change the status now.
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json(err.body);
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      details: err.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
    return;
  }

  console.error("Unhandled API error:", err);
  res.status(500).json({ error: "Internal server error" });
}
