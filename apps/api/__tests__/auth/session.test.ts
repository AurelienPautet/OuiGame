import crypto from "crypto";
import { db, schema } from "@ouigame/db";
import { eq } from "drizzle-orm";
import {
  hashToken,
  createSession,
  verifySession,
  deleteSession,
} from "../../auth/session";
import { cleanDb, createPlayer } from "../helpers/db";

// Direct unit tests for the session-token primitives. They run against the real
// test database (the same harness the route/middleware tests use) so the SHA-256
// lookup + expiration filter are exercised end-to-end, not mocked.

beforeEach(async () => {
  await cleanDb();
});

describe("hashToken", () => {
  test("is a deterministic SHA-256 hex digest", () => {
    const expected = crypto.createHash("sha256").update("abc").digest("hex");
    expect(hashToken("abc")).toBe(expected);
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  test("coerces non-string input via String()", () => {
    expect(hashToken(123 as unknown as string)).toBe(hashToken("123"));
  });
});

describe("createSession", () => {
  test("returns a 120-char plaintext token but persists only its hash", async () => {
    const player = await createPlayer();
    const token = await createSession(player.id);

    expect(token).toHaveLength(120);

    const rows = await db
      .select()
      .from(schema.playerSessions)
      .where(eq(schema.playerSessions.playerId, player.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.sessionToken).toBe(hashToken(token));
    expect(rows[0]!.sessionToken).not.toBe(token); // plaintext never stored
  });
});

describe("verifySession", () => {
  test("resolves a fresh token to the user record", async () => {
    const player = await createPlayer({
      username: "alice",
      email: "alice@example.com",
    });
    const token = await createSession(player.id);

    const user = await verifySession(token);
    expect(user).toMatchObject({
      playerId: player.id,
      username: "alice",
      email: "alice@example.com",
    });
  });

  test("accepts a session expiring in the future, rejects one in the past (gt is strict)", async () => {
    const player = await createPlayer();
    await db.insert(schema.playerSessions).values({
      playerId: player.id,
      sessionToken: hashToken("future-token"),
      expirationTimestamp: new Date(Date.now() + 1000),
    });
    await db.insert(schema.playerSessions).values({
      playerId: player.id,
      sessionToken: hashToken("past-token"),
      expirationTimestamp: new Date(Date.now() - 1000),
    });

    expect(await verifySession("future-token")).not.toBeNull();
    expect(await verifySession("past-token")).toBeNull();
  });

  test("short-circuits to null for missing tokens without querying", async () => {
    expect(await verifySession(null)).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession("")).toBeNull();
  });

  test("returns null for an unknown token", async () => {
    expect(await verifySession("nope-not-real")).toBeNull();
  });
});

describe("deleteSession", () => {
  test("removes the session so a later verify fails", async () => {
    const player = await createPlayer();
    const token = await createSession(player.id);
    expect(await verifySession(token)).not.toBeNull();

    await deleteSession(token);
    expect(await verifySession(token)).toBeNull();

    const rows = await db
      .select()
      .from(schema.playerSessions)
      .where(eq(schema.playerSessions.playerId, player.id));
    expect(rows).toHaveLength(0);
  });

  test("is a no-op for a missing token", async () => {
    await expect(deleteSession(null)).resolves.toBeUndefined();
    await expect(deleteSession("")).resolves.toBeUndefined();
  });
});
