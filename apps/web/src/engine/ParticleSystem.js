/**
 * ParticleSystem - Visual effects manager
 * Ported from legacy particle_system.js to preserve original aesthetic
 */

// --- Helper Functions (Legacy) ---

function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}

function randn_bm() {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  num = num / 10.0 + 0.5;
  if (num > 1 || num < 0) return randn_bm();
  return num;
}

function getRandomNormal(min, max) {
  return randn_bm() * (max - min) + min;
}

function gradientcolor(startColor, endColor, percentFade) {
  var diffRed = endColor.red - startColor.red;
  var diffGreen = endColor.green - startColor.green;
  var diffBlue = endColor.blue - startColor.blue;
  diffRed = diffRed * percentFade + startColor.red;
  diffGreen = diffGreen * percentFade + startColor.green;
  diffBlue = diffBlue * percentFade + startColor.blue;
  return `rgb(${diffRed},${diffGreen},${diffBlue})`;
}

function steppingradient(steps, percentFade) {
  let current_step = 0;
  for (let e = 0; e < steps.length; e++) {
    if (steps[e].percent < percentFade) {
      current_step = e;
    }
  }
  const begin = steps[current_step].percent;
  let end;
  if (current_step < steps.length - 1) {
    end = steps[current_step + 1].percent;
  } else {
    end = 1;
  }
  return gradientcolor(
    steps[current_step].color,
    steps[current_step + 1].color,
    (percentFade - begin) / (end - begin)
  );
}

// --- Classes ---

class Particle {
  constructor(position, angle, speed, radius, steps, timelife) {
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
  draw(c) {
    c.beginPath();
    c.arc(
      this.position.x,
      this.position.y,
      Math.max(0, this.radius), // Safety clamp from previous fix
      0,
      2 * Math.PI,
      false
    );
    c.fillStyle = steppingradient(
      this.steps,
      Math.min(1, this.timealive / this.timelife) // Safety clamp
    );
    c.fill();
    c.closePath();
  }
}

class Chockwave {
  constructor(position, speed, radius, width, startColor, endColor, timelife) {
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
  draw(c) {
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
  constructor() {
    this.particles = [];
    this.chockwaves = [];
  }

  update() {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].timealive >= this.particles[i].timelife) {
        this.particles.splice(i, 1);
      }
    }

    // Update shockwaves
    for (let i = this.chockwaves.length - 1; i >= 0; i--) {
      this.chockwaves[i].update();
      if (this.chockwaves[i].timealive >= this.chockwaves[i].timelife) {
        this.chockwaves.splice(i, 1);
      }
    }
  }

  draw(c) {
    this.particles.forEach((p) => p.draw(c));
    this.chockwaves.forEach((cw) => cw.draw(c));
  }

  clear() {
    this.particles = [];
    this.chockwaves = [];
  }

  // --- Effect Methods (Ported 1:1 from legacy code) ---

  explosion(position, num) {
    this.chockwaves.push(
      new Chockwave(
        structuredClone(position),
        10,
        0,
        13,
        { red: 255, green: 220, blue: 0 },
        { red: 255, green: 220, blue: 0 },
        30
      )
    );
    for (let e = 0; e < num; e++) {
      this.particles.push(
        new Particle(
          structuredClone(position),
          getRandomArbitrary(0, 360),
          getRandomArbitrary(0, 4),
          getRandomArbitrary(5, 15),
          [
            {
              color: {
                red: 255,
                green: Math.floor(getRandomArbitrary(220, 260)),
                blue: 39,
              },
              percent: 0,
            },
            {
              color: {
                red: 255,
                green: Math.floor(getRandomArbitrary(100, 120)),
                blue: 39,
              },
              percent: 0.4,
            },
            {
              color: {
                red: Math.floor(getRandomArbitrary(40, 60)),
                green: Math.floor(getRandomArbitrary(40, 60)),
                blue: Math.floor(getRandomArbitrary(40, 60)),
              },
              percent: 0.6,
            },
            {
              color: {
                red: Math.floor(getRandomArbitrary(220, 240)),
                green: Math.floor(getRandomArbitrary(220, 240)),
                blue: Math.floor(getRandomArbitrary(220, 240)),
              },
              percent: 1,
            },
          ],
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
          [
            { color: { red: 245, green: 251, blue: 0 }, percent: 0 },
            { color: { red: 240, green: 251, blue: 249 }, percent: 0.31 },
            { color: { red: 255, green: 255, blue: 255 }, percent: 0.52 },
            { color: { red: 252, green: 255, blue: 182 }, percent: 0.8 },
            { color: { red: 255, green: 239, blue: 90 }, percent: 1 },
          ],
          40
        )
      );
    }
  }

  bulletExplosion(position, num = 20) {
    this.chockwaves.push(
      new Chockwave(
        structuredClone(position),
        10,
        0,
        13,
        { red: 255, green: 220, blue: 0 },
        { red: 255, green: 220, blue: 0 },
        10
      )
    );
    for (let e = 0; e < num; e++) {
      this.particles.push(
        new Particle(
          structuredClone(position),
          getRandomArbitrary(0, 360),
          getRandomArbitrary(0, 2),
          getRandomArbitrary(2.5, 7.5),
          [
            {
              color: {
                red: 255,
                green: Math.floor(getRandomArbitrary(220, 260)),
                blue: 39,
              },
              percent: 0,
            },
            {
              color: {
                red: 255,
                green: Math.floor(getRandomArbitrary(100, 120)),
                blue: 39,
              },
              percent: 0.4,
            },
            {
              color: {
                red: Math.floor(getRandomArbitrary(40, 60)),
                green: Math.floor(getRandomArbitrary(40, 60)),
                blue: Math.floor(getRandomArbitrary(40, 60)),
              },
              percent: 0.6,
            },
            {
              color: {
                red: Math.floor(getRandomArbitrary(220, 240)),
                green: Math.floor(getRandomArbitrary(220, 240)),
                blue: Math.floor(getRandomArbitrary(220, 240)),
              },
              percent: 1,
            },
          ],
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
          [
            { color: { red: 245, green: 251, blue: 0 }, percent: 0 },
            { color: { red: 238, green: 136, blue: 136 }, percent: 0 },
            { color: { red: 240, green: 251, blue: 249 }, percent: 0.31 },
            { color: { red: 255, green: 255, blue: 255 }, percent: 0.52 },
            { color: { red: 252, green: 255, blue: 182 }, percent: 0.8 },
            { color: { red: 255, green: 239, blue: 90 }, percent: 1 },
          ],
          35
        )
      );
    }
  }

  ricochetSparks(position, angle, num) {
    for (let e = 0; e < num; e++) {
      this.particles.push(
        new Particle(
          structuredClone(position),
          angle + getRandomNormal((-50 * Math.PI) / 180, (50 * Math.PI) / 180),
          getRandomArbitrary(0, 2),
          getRandomArbitrary(1, 3),
          [
            {
              color: {
                red: 255,
                green: 255,
                blue: 255,
              },
              percent: 0,
            },
            {
              color: {
                red: 245,
                green: 251,
                blue: 0,
              },
              percent: 1,
            },
          ],
          50
        )
      );
    }
  }

  shootExplosion(position, angle, num) {
    this.chockwaves.push(
      new Chockwave(
        structuredClone(position),
        10,
        0,
        2,
        { red: 255, green: 220, blue: 0 },
        { red: 255, green: 220, blue: 0 },
        5
      )
    );
    for (let e = 0; e < num; e++) {
      this.particles.push(
        new Particle(
          structuredClone(position),
          angle + getRandomNormal((-60 * Math.PI) / 180, (60 * Math.PI) / 180),
          getRandomArbitrary(0.3, 3),
          getRandomArbitrary(5, 10),
          [
            {
              color: {
                red: 255,
                green: Math.floor(getRandomArbitrary(220, 260)),
                blue: 39,
              },
              percent: 0,
            },
            {
              color: {
                red: 255,
                green: Math.floor(getRandomArbitrary(100, 120)),
                blue: 39,
              },
              percent: 0.1,
            },
            {
              color: {
                red: Math.floor(getRandomArbitrary(40, 60)),
                green: Math.floor(getRandomArbitrary(40, 60)),
                blue: Math.floor(getRandomArbitrary(40, 60)),
              },
              percent: 0.3,
            },
            {
              color: {
                red: Math.floor(getRandomArbitrary(220, 240)),
                green: Math.floor(getRandomArbitrary(220, 240)),
                blue: Math.floor(getRandomArbitrary(220, 240)),
              },
              percent: 1,
            },
          ],
          60
        )
      );
    }
  }

  fastBullets(position, angle, num) {
    angle = angle - Math.PI;
    for (let e = 0; e < num; e++) {
      this.particles.push(
        new Particle(
          structuredClone(position),
          angle +
            getRandomNormal((-150 * Math.PI) / 180, (150 * Math.PI) / 180),
          getRandomArbitrary(0, -5), // Speed negative? Copied from legacy but seems odd with inverted angle
          getRandomArbitrary(2, 4),
          [
            {
              color: { red: 255, green: 0, blue: 0 },
              percent: 0,
            },
            {
              color: { red: 255, green: 255, blue: 255 },
              percent: 1,
            },
          ],
          7
        )
      );
    }
  }
}
