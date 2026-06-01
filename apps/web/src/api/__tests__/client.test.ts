import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the storage module so we control the session token the client injects.
vi.mock("../../lib/storage", () => ({
  storage: { getSessionId: vi.fn() },
}));

import { apiClient } from "../client";
import { storage } from "../../lib/storage";

const getSessionId = storage.getSessionId as ReturnType<typeof vi.fn>;

function mockFetchOnce({
  ok = true,
  status = 200,
  body = {},
}: {
  ok?: boolean;
  status?: number;
  body?: unknown;
}) {
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  getSessionId.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("auth header injection", () => {
  it("adds a Bearer header when a token is present", async () => {
    getSessionId.mockReturnValue("tok123");
    mockFetchOnce({ body: { ok: true } });
    await apiClient.get("/foo");
    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(init.headers.Authorization).toBe("Bearer tok123");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("omits the Authorization header when there is no token", async () => {
    getSessionId.mockReturnValue(null);
    mockFetchOnce({ body: {} });
    await apiClient.get("/foo");
    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });
});

describe("URL + verb helpers", () => {
  beforeEach(() => getSessionId.mockReturnValue(null));

  it("prefixes the base URL and uses the right method/body", async () => {
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;

    mockFetchOnce({ body: {} });
    await apiClient.get("/a");
    expect(calls[0][0]).toBe(`${apiClient.baseURL}/a`);
    expect(calls[0][1].method).toBe("GET");

    mockFetchOnce({ body: {} });
    await apiClient.post("/b", { x: 1 });
    expect(calls[1][1].method).toBe("POST");
    expect(calls[1][1].body).toBe(JSON.stringify({ x: 1 }));

    mockFetchOnce({ body: {} });
    await apiClient.put("/c", { y: 2 });
    expect(calls[2][1].method).toBe("PUT");
    expect(calls[2][1].body).toBe(JSON.stringify({ y: 2 }));

    mockFetchOnce({ body: {} });
    await apiClient.delete("/d");
    expect(calls[3][1].method).toBe("DELETE");
  });
});

describe("responses", () => {
  beforeEach(() => getSessionId.mockReturnValue(null));

  it("returns the parsed body on success", async () => {
    mockFetchOnce({ ok: true, body: { hello: "world" } });
    await expect(apiClient.get("/ok")).resolves.toEqual({ hello: "world" });
  });

  it("throws with message precedence message -> error -> 'Request failed'", async () => {
    mockFetchOnce({
      ok: false,
      status: 400,
      body: { message: "boom", error: "e" },
    });
    await expect(apiClient.get("/x")).rejects.toThrow("boom");

    mockFetchOnce({ ok: false, status: 403, body: { error: "nope" } });
    await expect(apiClient.get("/x")).rejects.toThrow("nope");

    mockFetchOnce({ ok: false, status: 500, body: {} });
    await expect(apiClient.get("/x")).rejects.toThrow("Request failed");
  });

  it("attaches status + data to the thrown error", async () => {
    mockFetchOnce({
      ok: false,
      status: 409,
      body: { error: "dup", field: "name" },
    });
    await expect(apiClient.get("/x")).rejects.toMatchObject({
      status: 409,
      data: { error: "dup", field: "name" },
    });
  });

  it("falls back to 'Request failed' when the body isn't JSON", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error("not json")),
    });
    await expect(apiClient.get("/x")).rejects.toThrow("Request failed");
  });
});
