import type { Request, Response, NextFunction } from "express";

// Rejects the request with 403 unless the authenticated user is an admin.
// Assumes authMiddleware has already run and populated req.user; chain it AFTER
// authMiddleware (which handles the 401 missing/invalid-session case).
function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: "Forbidden: admin access required" });
  }
  next();
}

export { adminMiddleware };
