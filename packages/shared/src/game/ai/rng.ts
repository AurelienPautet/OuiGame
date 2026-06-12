// Seeded RNG for the v2 bot AI. Every stochastic AI decision draws from a
// per-bot Rng so a pinned `Room.bot_seed` makes bot behaviour reproducible in
// tests, while default rooms stay varied (the seed itself is random). The
// legacy AI's bare Math.random calls are untouched.

// mulberry32: tiny, fast, good-enough 32-bit PRNG for gameplay decisions.
export class Rng {
  private s: number;
  private spare = 0;
  private hasSpare = false;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  // Uniform in [0, 1).
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Uniform in [a, b).
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  // Integer in [0, n).
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  sign(): 1 | -1 {
    return this.next() < 0.5 ? -1 : 1;
  }

  // Standard normal via Box-Muller, caching the spare value so consecutive
  // calls cost one transcendental pair per two samples.
  gaussian(): number {
    if (this.hasSpare) {
      this.hasSpare = false;
      return this.spare;
    }
    let u = 0;
    // Guard against log(0); next() can return exactly 0.
    do {
      u = this.next();
    } while (u === 0);
    const v = this.next();
    const mag = Math.sqrt(-2 * Math.log(u));
    this.spare = mag * Math.sin(2 * Math.PI * v);
    this.hasSpare = true;
    return mag * Math.cos(2 * Math.PI * v);
  }
}

// FNV-1a 32-bit string hash — derives a stable per-bot seed from its socketid
// so each bot in a room gets a distinct, reproducible stream.
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
