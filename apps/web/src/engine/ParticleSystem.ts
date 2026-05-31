/**
 * ParticleSystem - Visual effects manager
 *
 * The particle *physics* (motion, radius/velocity decay, lifetimes) are the
 * legacy ones — they feel good and are left untouched. The *colours* are now
 * driven by the shared theme/palette so bursts match the "diep.io arcade"
 * look the Renderer and TankAvatar use: flat saturated team colours, warm
 * yellow→orange→red debris that chars to ink, no realistic fire-to-grey-smoke
 * gradients. Change a colour in theme/palette and the sparks follow.
 */
import { palette, hexToRgb, type Rgb } from "../theme/palette";

// --- Types ---

interface Vec2 {
  x: number;
  y: number;
}

type RGB = Rgb;

interface GradientStep {
  color: RGB;
  percent: number;
}

// --- Helper Functions (Legacy) ---

function getRandomArbitrary(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randn_bm(): number {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  num = num / 10.0 + 0.5;
  if (num > 1 || num < 0) return randn_bm();
  return num;
}

function getRandomNormal(min: number, max: number): number {
  return randn_bm() * (max - min) + min;
}

function gradientcolor(
  startColor: RGB,
  endColor: RGB,
  percentFade: number
): string {
  let diffRed = endColor.red - startColor.red;
  let diffGreen = endColor.green - startColor.green;
  let diffBlue = endColor.blue - startColor.blue;
  diffRed = diffRed * percentFade + startColor.red;
  diffGreen = diffGreen * percentFade + startColor.green;
  diffBlue = diffBlue * percentFade + startColor.blue;
  return `rgb(${diffRed},${diffGreen},${diffBlue})`;
}

function steppingradient(steps: GradientStep[], percentFade: number): string {
  let current_step = 0;
  for (let e = 0; e < steps.length; e++) {
    const step = steps[e];
    if (step !== undefined && step.percent < percentFade) {
      current_step = e;
    }
  }
  // current_step is always a valid index (0..steps.length-1) from the loop.
  const currentStep = steps[current_step]!;
  // The legacy code reads steps[current_step + 1].color unconditionally; callers
  // always pass a gradient whose final step has percent: 1 with percentFade
  // clamped to <= 1, so the next step is present at runtime. The non-null
  // assertion preserves that always-defined behavior (an undefined would have
  // thrown in the original too).
  const nextStep = steps[current_step + 1]!;
  const begin = currentStep.percent;
  let end;
  if (current_step < steps.length - 1) {
    end = nextStep.percent;
  } else {
    end = 1;
  }
  return gradientcolor(
    currentStep.color,
    nextStep.color,
    (percentFade - begin) / (end - begin)
  );
}

// --- Arcade palette (single source of truth: theme/palette) ---

const YELLOW = hexToRgb(palette.yellow);
const ORANGE = hexToRgb(palette.orange);
const RED = hexToRgb(palette.red);
const INK = hexToRgb(palette.ink);
const WHITE = hexToRgb(palette.white);

function clamp8(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

// Nudge each channel by ±amount so a burst of identical-colour particles still
// has a little variation (the legacy code jittered the green channel inline).
function jitter(base: RGB, amount: number): RGB {
  return {
    red: clamp8(base.red + getRandomArbitrary(-amount, amount)),
    green: clamp8(base.green + getRandomArbitrary(-amount, amount)),
    blue: clamp8(base.blue + getRandomArbitrary(-amount, amount)),
  };
}

// Warm arcade debris: bright yellow core → orange → red → charred ink. Flat
// saturated steps (no grey ash / white smoke) so it reads as cartoon, matching
// the warm bullet colours.
function warmDebris(): GradientStep[] {
  return [
    { color: jitter(YELLOW, 12), percent: 0 },
    { color: jitter(ORANGE, 14), percent: 0.35 },
    { color: jitter(RED, 14), percent: 0.7 },
    { color: jitter(INK, 8), percent: 1 },
  ];
}

// Tiny hot sparks: white flash → yellow → orange.
function brightSpark(): GradientStep[] {
  return [
    { color: WHITE, percent: 0 },
    { color: jitter(YELLOW, 10), percent: 0.5 },
    { color: jitter(ORANGE, 12), percent: 1 },
  ];
}

// --- Classes ---

class Particle {
  position: Vec2;
  angle: number;
  speed: number;
  steps: GradientStep[];
  timealive: number;
  timelife: number;
  radius: number;
  velocity: Vec2;

  constructor(
    position: Vec2,
    angle: number,
    speed: number,
    radius: number,
    steps: GradientStep[],
    timelife: number
  ) {
    this.position = position;
    this.angle = angle;
    this.speed = speed;
    this.steps = steps;
    this.timealive = 0;
    this.timelife = timelife;
    this.radius = radius;
    this.velocity = {
      x: -Math.cos(this.angle) * this.speed,
      y: -Math.sin(this.angle) * this.speed,
    };
  }
  update() {
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;
    this.radius =
      this.radius * (1 - 0.3 * (this.timealive / this.timelife) ** 3);
    this.velocity.x =
      this.velocity.x * (1 - 0.3 * (this.timealive / this.timelife) ** 4);
    this.velocity.y =
      this.velocity.y * (1 - 0.3 * (this.timealive / this.timelife) ** 4);
    this.timealive++;
  }
  draw(c: CanvasRenderingContext2D) {
    const fade = Math.min(1, this.timealive / this.timelife); // Safety clamp
    // Dissolve over the last 35% of life so debris melts out cleanly instead
    // of popping at full size (the legacy version just vanished).
    const FADE_FROM = 0.65;
    const alpha =
      fade > FADE_FROM ? 1 - (fade - FADE_FROM) / (1 - FADE_FROM) : 1;
    c.save();
    c.globalAlpha = alpha;
    c.beginPath();
    c.arc(
      this.position.x,
      this.position.y,
      Math.max(0, this.radius), // Safety clamp from previous fix
      0,
      2 * Math.PI,
      false
    );
    c.fillStyle = steppingradient(this.steps, fade);
    c.fill();
    c.closePath();
    c.restore();
  }
}

class Chockwave {
  position: Vec2;
  speed: number;
  width: number;
  startColor: RGB;
  endColor: RGB;
  timealive: number;
  timelife: number;
  radius: number;

  constructor(
    position: Vec2,
    speed: number,
    radius: number,
    width: number,
    startColor: RGB,
    endColor: RGB,
    timelife: number
  ) {
    this.position = position;
    this.speed = speed;
    this.width = width;
    this.startColor = startColor;
    this.endColor = endColor;
    this.timealive = 0;
    this.timelife = timelife;
    this.radius = radius;
  }
  update() {
    this.speed = this.speed * 0.99;
    this.radius += this.speed;
    this.width = this.width * 0.8;
    this.timealive++;
  }
  draw(c: CanvasRenderingContext2D) {
    const percentFade = Math.min(1, this.timealive / this.timelife);
    c.beginPath();
    c.arc(
      this.position.x,
      this.position.y,
      Math.max(0, this.radius),
      0,
      Math.PI * 2,
      false
    );
    c.arc(
      this.position.x,
      this.position.y,
      Math.max(0, this.radius + this.width),
      0,
      Math.PI * 2,
      true
    );
    c.fillStyle = gradientcolor(this.startColor, this.endColor, percentFade);
    c.fill();
    c.closePath();
  }
}

// --- Main System ---

export class ParticleSystem {
  particles: Particle[];
  chockwaves: Chockwave[];
  // When false, emitters drop their bursts so no particles are spawned (and the
  // existing ones are cleared). Driven by the "particles" user setting.
  enabled = true;

  constructor() {
    this.particles = [];
    this.chockwaves = [];
  }

  /** Enable/disable particle emission; clears live particles when turned off. */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  update() {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      if (particle === undefined) continue;
      particle.update();
      if (particle.timealive >= particle.timelife) {
        this.particles.splice(i, 1);
      }
    }

    // Update shockwaves
    for (let i = this.chockwaves.length - 1; i >= 0; i--) {
      const chockwave = this.chockwaves[i];
      if (chockwave === undefined) continue;
      chockwave.update();
      if (chockwave.timealive >= chockwave.timelife) {
        this.chockwaves.splice(i, 1);
      }
    }
  }

  draw(c: CanvasRenderingContext2D) {
    this.particles.forEach((p) => p.draw(c));
    this.chockwaves.forEach((cw) => cw.draw(c));
  }

  clear() {
    this.particles = [];
    this.chockwaves = [];
  }

  // --- Effect Methods (physics legacy, colours arcade-palette driven) ---

  explosion(position: Vec2, num: number) {
    if (!this.enabled) return;
    this.chockwaves.push(
      new Chockwave(structuredClone(position), 10, 0, 13, WHITE, YELLOW, 30)
    );
    for (let e = 0; e < num; e++) {
      this.particles.push(
        new Particle(
          structuredClone(position),
          getRandomArbitrary(0, 360),
          getRandomArbitrary(0, 4),
          getRandomArbitrary(5, 15),
          warmDebris(),
          40
        )
      );
    }
    for (let e = 0; e < Math.floor(num / 10); e++) {
      this.particles.push(
        new Particle(
          structuredClone(position),
          getRandomArbitrary(0, 360),
          getRandomArbitrary(4, 7),
          getRandomArbitrary(1.5, 2),
          brightSpark(),
          40
        )
      );
    }
  }

  bulletExplosion(position: Vec2, num = 20) {
    if (!this.enabled) return;
    this.chockwaves.push(
      new Chockwave(structuredClone(position), 10, 0, 13, WHITE, YELLOW, 10)
    );
    for (let e = 0; e < num; e++) {
      this.particles.push(
        new Particle(
          structuredClone(position),
          getRandomArbitrary(0, 360),
          getRandomArbitrary(0, 2),
          getRandomArbitrary(2.5, 7.5),
          warmDebris(),
          20
        )
      );
    }
    for (let e = 0; e < Math.floor(num / 10); e++) {
      this.particles.push(
        new Particle(
          structuredClone(position),
          getRandomArbitrary(0, 360),
          getRandomArbitrary(2, 3),
          getRandomArbitrary(1.5, 2),
          brightSpark(),
          35
        )
      );
    }
  }

  ricochetSparks(position: Vec2, angle: number, num: number) {
    if (!this.enabled) return;
    for (let e = 0; e < num; e++) {
      this.particles.push(
        new Particle(
          structuredClone(position),
          angle + getRandomNormal((-50 * Math.PI) / 180, (50 * Math.PI) / 180),
          getRandomArbitrary(0, 2),
          getRandomArbitrary(1, 3),
          [
            { color: WHITE, percent: 0 },
            { color: jitter(YELLOW, 10), percent: 1 },
          ],
          50
        )
      );
    }
  }

  shootExplosion(position: Vec2, angle: number, num: number) {
    if (!this.enabled) return;
    this.chockwaves.push(
      new Chockwave(structuredClone(position), 10, 0, 2, WHITE, YELLOW, 5)
    );
    for (let e = 0; e < num; e++) {
      // Muzzle flash chars early (ink by ~half-life) so it snaps shut quickly.
      // NOTE: the final step must stay at percent 1 — steppingradient reads the
      // step after the last one it lands on, so an early-terminating gradient
      // would index past the array.
      this.particles.push(
        new Particle(
          structuredClone(position),
          angle + getRandomNormal((-60 * Math.PI) / 180, (60 * Math.PI) / 180),
          getRandomArbitrary(0.3, 3),
          getRandomArbitrary(5, 10),
          [
            { color: jitter(YELLOW, 12), percent: 0 },
            { color: jitter(ORANGE, 14), percent: 0.15 },
            { color: jitter(RED, 14), percent: 0.35 },
            { color: jitter(INK, 8), percent: 1 },
          ],
          60
        )
      );
    }
  }

  fastBullets(position: Vec2, angle: number, num: number) {
    if (!this.enabled) return;
    angle = angle - Math.PI;
    for (let e = 0; e < num; e++) {
      // Rocket trail: hot yellow flash cooling to orange, dissolving fast.
      this.particles.push(
        new Particle(
          structuredClone(position),
          angle +
            getRandomNormal((-150 * Math.PI) / 180, (150 * Math.PI) / 180),
          getRandomArbitrary(0, -5), // Speed negative? Copied from legacy but seems odd with inverted angle
          getRandomArbitrary(2, 4),
          [
            { color: WHITE, percent: 0 },
            { color: jitter(YELLOW, 12), percent: 0.4 },
            { color: jitter(ORANGE, 14), percent: 1 },
          ],
          7
        )
      );
    }
  }
}
