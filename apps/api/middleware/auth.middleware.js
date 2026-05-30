const { verifySession } = require("../auth/session");

function getToken(req) {
  return req.headers.authorization?.replace("Bearer ", "");
}

// Rejects the request with 401 unless a valid session token is present.
async function authMiddleware(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ error: "No session token provided" });
  }

  try {
    const user = await verifySession(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
}

// Attaches req.user when a valid token is present, but never blocks the request.
async function optionalAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return next();

  try {
    const user = await verifySession(token);
    if (user) req.user = user;
  } catch (err) {
    console.error("optionalAuth error:", err);
  }
  next();
}

module.exports = { authMiddleware, optionalAuth };
