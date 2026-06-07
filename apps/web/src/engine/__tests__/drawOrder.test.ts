import { describe, it, expect } from "vitest";
import { orderPlayersForDraw } from "../Renderer.js";

// Regression for: "a dead tank's corpse can show above an alive player". Players
// arrive in a map with arbitrary iteration order, so the draw loop must order
// corpses (alive=false) ahead of living tanks — otherwise a wreck drawn later
// paints over a live player.
describe("orderPlayersForDraw", () => {
  it("draws every corpse before any living tank", () => {
    // Map deliberately interleaves dead/alive, with a dead entry last so the
    // raw iteration order would paint it over the live tanks.
    const players = {
      a: { alive: true },
      b: { alive: false },
      c: { alive: true },
      d: { alive: false },
    };

    const order = orderPlayersForDraw(players).map(([id]) => id);

    const lastDead = order.lastIndexOf("b") > order.indexOf("d") ? "b" : "d";
    const firstAliveIdx = Math.min(order.indexOf("a"), order.indexOf("c"));
    // Both dead tanks must come before the first alive tank.
    expect(order.indexOf("b")).toBeLessThan(firstAliveIdx);
    expect(order.indexOf("d")).toBeLessThan(firstAliveIdx);
    // The very last drawn (top-most) must be a living tank, never a corpse.
    expect(["a", "c"]).toContain(order[order.length - 1]);
    expect(order[order.length - 1]).not.toBe(lastDead);
  });

  it("keeps insertion order within the dead and alive groups (stable sort)", () => {
    const players = {
      d1: { alive: false },
      a1: { alive: true },
      d2: { alive: false },
      a2: { alive: true },
    };

    const order = orderPlayersForDraw(players).map(([id]) => id);

    expect(order).toEqual(["d1", "d2", "a1", "a2"]);
  });

  it("leaves an all-alive or all-dead set in its original order", () => {
    const alive = { x: { alive: true }, y: { alive: true } };
    const dead = { x: { alive: false }, y: { alive: false } };

    expect(orderPlayersForDraw(alive).map(([id]) => id)).toEqual(["x", "y"]);
    expect(orderPlayersForDraw(dead).map(([id]) => id)).toEqual(["x", "y"]);
  });
});
