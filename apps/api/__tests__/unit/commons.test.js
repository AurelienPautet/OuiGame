const { makeid } = require("@ouigame/shared/game");

describe("makeid", () => {
  test("returns a string of the requested length", () => {
    expect(makeid(10)).toHaveLength(10);
    expect(makeid(120)).toHaveLength(120);
  });

  test("returns an empty string for length 0", () => {
    expect(makeid(0)).toBe("");
  });

  test("uses only alphanumeric characters", () => {
    const id = makeid(500);
    expect(id).toMatch(/^[A-Za-z0-9]+$/);
  });

  test("is highly unlikely to collide", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => makeid(20)));
    expect(ids.size).toBe(1000);
  });
});
