import { describe, it, expect } from "vitest";
import { orderPlayersForDraw } from "../Renderer.js";

// Regression for: "a dead tank's corpse can show above an alive player". Players
// arrive in a map with arbitrary iteration order, so the draw loop must order
// corpses (alive=false) ahead of living tanks — otherwise a wreck drawn later
// paints over a live player.
describe("orderPlayersForDraw", () => {
  it("draws every corpse before any living tank", () => {
    // Interleaved, with a dead entry (`d`) last — the case where the raw
    // iteration order would paint a corpse over the live tanks.
    const players = {
      a: { alive: true },
      b: { alive: false },
      c: { alive: true },
      d: { alive: false },
    };

    const order = orderPlayersForDraw(players).map(([id]) => id);

    // Both corpses come first (in their original relative order), both living
    // tanks last — so the top-most thing drawn is always a live tank.
    expect(order).toEqual(["b", "d", "a", "c"]);
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

  it("treats a non-boolean alive value as a corpse (matches _drawPlayer's truthiness)", () => {
    // draw() reaches orderPlayersForDraw via an `as unknown as` cast, so `alive`
    // can in principle arrive non-boolean. _drawPlayer renders anything falsy as
    // a wreck, so the ordering must push it to the back too — a plain numeric
    // coercion (Number(undefined) === NaN) would wrongly leave it in place.
    const players = {
      x: { alive: true },
      u: { alive: undefined },
      y: { alive: true },
    } as unknown as Record<string, { alive: boolean }>;

    const order = orderPlayersForDraw(players).map(([id]) => id);

    expect(order[0]).toBe("u");
  });
});
