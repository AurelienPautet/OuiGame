// Augments Express's Request with the fields our middleware attaches:
//  - `user` is set by authMiddleware/optionalAuth from a verified session
//    (exactly the shape auth/session.verifySession returns).
//  - `validatedQuery` is where validate.middleware writes the Zod-parsed query
//    (Express 5's req.query is a read-only getter, so it can't be reassigned).
import "express";

declare global {
  namespace Express {
    interface Request {
      user?: { playerId: number; username: string; email: string };
      validatedQuery?: unknown;
    }
  }
}

export {};
