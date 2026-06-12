import { Rng, fnv1a } from "../../ai/rng.js";

describe("Rng (mulberry32)", () => {
  it("produces the identical stream for the same seed", () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it("produces different streams for different seeds", () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const sameCount = Array.from({ length: 20 }, () =>
      a.next() === b.next() ? 1 : 0
    ).reduce((x: number, y: number) => x + y, 0);
    expect(sameCount).toBeLessThan(3);
  });

  it("next() stays in [0, 1)", () => {
    const r = new Rng(99);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("range/int/sign respect their bounds", () => {
    const r = new Rng(7);
    for (let i = 0; i < 200; i++) {
      const v = r.range(-3, 5);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThan(5);
      const n = r.int(4);
      expect([0, 1, 2, 3]).toContain(n);
      expect([1, -1]).toContain(r.sign());
    }
  });

  it("gaussian() is roughly standard normal", () => {
    const r = new Rng(42);
    const n = 4000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const v = r.gaussian();
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / n;
    const sd = Math.sqrt(sumSq / n - mean * mean);
    expect(Math.abs(mean)).toBeLessThan(0.1);
    expect(sd).toBeGreaterThan(0.85);
    expect(sd).toBeLessThan(1.15);
  });
});

describe("fnv1a", () => {
  it("is stable and distinguishes bot ids", () => {
    expect(fnv1a("bot0")).toBe(fnv1a("bot0"));
    // FNV-1a offset basis: hash of the empty string.
    expect(fnv1a("")).toBe(0x811c9dc5);
    const hashes = new Set(
      Array.from({ length: 16 }, (_, i) => fnv1a(`bot${i}`))
    );
    expect(hashes.size).toBe(16);
  });

  it("returns unsigned 32-bit integers", () => {
    for (const s of ["bot0", "bot13", "a", "longer-socket-id"]) {
      const h = fnv1a(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });
});
