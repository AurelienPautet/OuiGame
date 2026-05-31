import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the shared apiClient so we can assert the exact URL/verb/payload each
// endpoint builder produces (query encoding + path interpolation are the
// behaviours worth pinning).
vi.mock("../../client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from "../../client";
import { levelsApi } from "../levels";
import { soloApi } from "../solo";
import { campaignsApi } from "../campaigns";

const get = apiClient.get as ReturnType<typeof vi.fn>;
const post = apiClient.post as ReturnType<typeof vi.fn>;
const put = apiClient.put as ReturnType<typeof vi.fn>;
const del = apiClient.delete as ReturnType<typeof vi.fn>;

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
  del.mockReset();
});

describe("levelsApi", () => {
  it("encodes the levels query (name uses encodeURIComponent)", () => {
    levelsApi.getLevels({ name: "a b", players: 2, type: "solo" });
    expect(get).toHaveBeenCalledWith("/levels?name=a%20b&players=2&type=solo");
  });
  it("applies query defaults", () => {
    levelsApi.getLevels({});
    expect(get).toHaveBeenCalledWith("/levels?name=&players=0&type=online");
  });
  it("interpolates ids and forwards mutation payloads", () => {
    levelsApi.getLevel(7);
    expect(get).toHaveBeenCalledWith("/levels/7");
    levelsApi.getLevelJson(7);
    expect(get).toHaveBeenCalledWith("/levels/7/json");
    levelsApi.updateLevel(7, { foo: 1 } as never);
    expect(put).toHaveBeenCalledWith("/levels/7", { foo: 1 });
    levelsApi.deleteLevel(7);
    expect(del).toHaveBeenCalledWith("/levels/7");
    levelsApi.rateLevel(7, 4);
    expect(post).toHaveBeenCalledWith("/levels/7/rate", { stars: 4 });
  });
});

describe("soloApi", () => {
  it("applies the default leaderboard limits", () => {
    soloApi.getLevelLeaderboard(3);
    expect(get).toHaveBeenCalledWith("/solo/levels/3/leaderboard?limit=20");
    soloApi.getGlobalLeaderboard("KILLS" as never);
    expect(get).toHaveBeenCalledWith("/solo/leaderboard/KILLS?limit=50");
  });
  it("posts a submitted round", () => {
    soloApi.submitRound({ levelId: 1 } as never);
    expect(post).toHaveBeenCalledWith("/solo/rounds", { levelId: 1 });
  });
});

describe("campaignsApi", () => {
  it("encodes the name query and interpolates run ids", () => {
    campaignsApi.getCampaigns({ name: "x y" });
    expect(get).toHaveBeenCalledWith("/campaigns?name=x%20y");
    campaignsApi.submitRun(5, { completed: true } as never);
    expect(post).toHaveBeenCalledWith("/campaigns/5/runs", { completed: true });
  });
});
