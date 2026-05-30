const { makeid } = require("../scripts/commons.js");

// shared/ is CommonJS (module.exports) and stays at the repo root until the
// Phase 2 keystone, so require() is the natural import for the helper under
// test. Vitest itself cannot be required() from a CommonJS file, so we rely on
// the project's `globals: true` setting for describe/it/expect (ambient, no
// import needed). The `shared` Vitest project runs in the node environment to
// match this code's runtime.
describe("shared smoke", () => {
  it("loads a CommonJS shared helper", () => {
    expect(typeof makeid).toBe("function");
  });

  it("makeid returns a string of the requested length", () => {
    expect(makeid(8)).toHaveLength(8);
  });
});
