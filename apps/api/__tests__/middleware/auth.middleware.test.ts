import { authMiddleware, optionalAuth } from "../../middleware/auth.middleware";
import { db, schema } from "@ouigame/db";
import { hashToken } from "../../auth/session";
import { cleanDb, createPlayer, createSession } from "../helpers/db";

// The middlewares are exercised by calling them directly with mock req/res/next
// objects rather than mounting Express routes. This keeps the unit under test
// isolated (no HTTP layer) and avoids tripping static-analysis rules about
// unprotected route handlers on what is purely test scaffolding.
function mockReq(authHeader?: string): any {
  return { headers: authHeader ? { authorization: authHeader } : {} };
}

function mockRes(): any {
  const res: any = {};
  res.statusCode = null;
  res.body = undefined;
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload: any) => {
    res.body = payload;
    return res;
  });
  return res;
}

beforeEach(async () => {
  await cleanDb();
});

describe("authMiddleware", () => {
  test("rejects requests with no token (401)", async () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body.error).toMatch(/No session token/i);
  });

  test("rejects an unknown token (401)", async () => {
    const req = mockReq("Bearer not-a-real-token");
    const res = mockRes();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body.error).toMatch(/Invalid or expired/i);
  });

  test("rejects an expired session (401)", async () => {
    const player = await createPlayer();
    await db.insert(schema.playerSessions).values({
      playerId: player.id,
      // Stored hashed, like production, so the middleware's hashed lookup of the
      // presented token resolves to this row and then rejects it as expired.
      sessionToken: hashToken("expired-token"),
      expirationTimestamp: new Date(Date.now() - 1000),
    });

    const req = mockReq("Bearer expired-token");
    const res = mockRes();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("attaches the user and calls next for a valid session", async () => {
    const player = await createPlayer({
      username: "alice",
      email: "alice@example.com",
    });
    const token = await createSession(player.id);

    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toMatchObject({
      playerId: player.id,
      username: "alice",
      email: "alice@example.com",
    });
  });
});

describe("optionalAuth", () => {
  test("continues without a user when no token is provided", async () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  test("continues without a user on an invalid token", async () => {
    const req = mockReq("Bearer bogus");
    const res = mockRes();
    const next = jest.fn();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  test("attaches the user for a valid session", async () => {
    const player = await createPlayer();
    const token = await createSession(player.id);

    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();
    const next = jest.fn();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.playerId).toBe(player.id);
  });
});
