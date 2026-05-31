/**
 * Renderer - Handles all canvas drawing for the game
 * Draws tanks, bullets, mines, blocks, and effects
 *
 * Visuals are the "diep.io arcade" style: a light graph-paper field, flat
 * cartoon shapes with thick dark outlines, team colours — all drawn
 * programmatically (no per-colour sprite sheets). Colours come from the shared
 * theme/palette so the canvas matches the DOM (TankAvatar etc.).
 */
import { palette, tankColors, mixHex, WRECK_CHAR } from "../theme/palette";
import { drawTank, paintField, drawBlocks, drawHole } from "./shapes";

const INK = palette.ink;
// Matches the game's tile size (TILE = 50 in shared/game/loadlevel.js: a 23×16
// map = 1150×800), so grid lines fall exactly on block edges.
const GRID_CELL = 50;
// Bullets cycle through warm team colours by bounce count.
const BULLET_COLORS = [
  palette.yellow,
  palette.orange,
  palette.red,
  palette.purple,
];

interface Vec2 {
  x: number;
  y: number;
}

interface Size {
  w: number;
  h: number;
}

interface Mine {
  position: Vec2;
  radius: number;
  color?: string;
  timealive: number;
}

interface Hole {
  position: Vec2;
  size: Size;
}

interface Block {
  position: Vec2;
  size: Size;
  type: number;
}

interface CollisionBox {
  position: Vec2;
  size: Size;
}

interface Bullet {
  position: Vec2;
  size: Size;
  angle: number;
  type?: number;
  bounce?: number;
}

interface RenderPlayer {
  alive: boolean;
  position: Vec2;
  size: Size;
  rotation: number;
  angle: number;
  bodyc: string;
  turretc: string;
  turretsize: Size;
}

interface GameState {
  mines?: Mine[];
  holes?: Hole[];
  blocks?: Block[];
  Bcollision?: CollisionBox[];
  bullets?: Bullet[];
  players?: Record<string, RenderPlayer>;
}

interface DrawableEffect {
  timealive: number;
  timelife: number;
  draw(c: CanvasRenderingContext2D): void;
}

export class Renderer {
  canvas: HTMLCanvasElement;
  fadingCanvas: HTMLCanvasElement | null;
  c: CanvasRenderingContext2D;
  fc: CanvasRenderingContext2D | null;
  width: number;
  height: number;
  debugVisual: boolean;
  drawTicks: number;
  theme: number;
  fieldImage: HTMLCanvasElement | null;

  constructor(
    canvas: HTMLCanvasElement,
    fadingCanvas: HTMLCanvasElement | null = null
  ) {
    this.canvas = canvas;
    this.fadingCanvas = fadingCanvas;
    // The game runtime assumes a 2D context is always available; assert it so
    // the rest of the renderer can treat `c`/`fc` as non-null.
    this.c = canvas.getContext("2d")!;
    this.fc = fadingCanvas ? fadingCanvas.getContext("2d") : null;

    this.width = 1150;
    this.height = 800;
    canvas.width = this.width;
    canvas.height = this.height;
    if (fadingCanvas) {
      fadingCanvas.width = this.width;
      fadingCanvas.height = this.height;
    }

    this.debugVisual = false;
    this.drawTicks = 0;
    this.theme = 6;

    // Pre-rendered graph-paper field, seeded onto the (back) fading canvas so
    // the grid is present from frame 0.
    this.fieldImage = this._buildFieldImage();
    this._seedField();
  }

  _buildFieldImage(): HTMLCanvasElement | null {
    if (typeof document === "undefined") return null;
    const off = document.createElement("canvas");
    off.width = this.width;
    off.height = this.height;
    const g = off.getContext("2d");
    if (!g) return null;
    paintField(g, this.width, this.height, GRID_CELL);
    return off;
  }

  // Paint the field at full opacity once so there is no grey "fade-in".
  _seedField() {
    if (this.fc && this.fieldImage) {
      this.fc.globalAlpha = 1;
      this.fc.drawImage(this.fieldImage, 0, 0, this.width, this.height);
    }
  }

  // The theme number still drives gameplay elsewhere; the renderer no longer
  // swaps art per theme (everything is palette-driven), so this is a no-op kept
  // for the GameEngine.setTheme call site.
  setTheme(theme: number) {
    this.theme = theme;
  }

  clear() {
    this.c.clearRect(0, 0, this.width, this.height);
    // Repaint the crisp graph-paper field on the back (fading) canvas at full
    // opacity every frame. This wipes the previous frame cleanly — no trail
    // residue — and keeps a sharp static grid behind the transparent entity
    // canvas.
    if (this.fc && this.fieldImage) {
      this.fc.globalAlpha = 1;
      this.fc.drawImage(this.fieldImage, 0, 0, this.width, this.height);
    }
  }

  draw(gameState: GameState) {
    this.drawTicks++;
    this.clear();

    const { mines, holes, blocks, Bcollision, bullets, players } = gameState;

    if (mines) {
      mines.forEach((mine) => this._drawMine(mine));
    }

    if (holes) {
      holes.forEach((h) => this._drawHole(h));
    }

    if (blocks) {
      this._drawBlocks(blocks);
    }

    // Draw collision debug
    if (this.debugVisual && Bcollision) {
      this._drawCollisionDebug(Bcollision);
    }

    // Draw bullets
    if (bullets) {
      bullets.forEach((bullet) => this._drawBullet(bullet));
    }

    // Draw players
    if (players) {
      Object.entries(players).forEach(([socketId, player]) => {
        this._drawPlayer(player, socketId);
      });
    }
  }

  _drawMine(mine: Mine) {
    let color = mine.color || "gray";

    // Flashing effect when about to explode
    if (mine.timealive > 220) {
      if (mine.timealive > 260) {
        color = mine.timealive % 6 < 3 ? "yellow" : "red";
      } else {
        color = mine.timealive % 10 < 5 ? "yellow" : "red";
      }
    }

    this.c.beginPath();
    this.c.arc(mine.position.x, mine.position.y, mine.radius, 0, Math.PI * 2);
    this.c.fillStyle = color;
    this.c.fill();
    this.c.lineWidth = 3;
    this.c.strokeStyle = INK;
    this.c.stroke();
    this.c.closePath();
  }

  _drawHole(h: Hole) {
    drawHole(this.c, h);
    if (this.debugVisual) {
      this.c.beginPath();
      this.c.fillStyle = "rgba(255,0,0,0.4)";
      this.c.strokeStyle = "red";
      this.c.rect(h.position.x, h.position.y, h.size.w, h.size.h);
      this.c.fill();
      this.c.stroke();
    }
  }

  _drawBlocks(blocks: Block[]) {
    drawBlocks(this.c, blocks);
  }

  _drawCollisionDebug(Bcollision: CollisionBox[]) {
    this.c.beginPath();
    this.c.strokeStyle = "red";
    this.c.fillStyle = "rgba(255, 0, 0, 0.01)";
    Bcollision.forEach((Bcol) => {
      this.c.rect(Bcol.position.x, Bcol.position.y, Bcol.size.w, Bcol.size.h);
      this.c.fill();
      this.c.stroke();
    });
  }

  _drawBullet(bullet: Bullet) {
    const bounceCount = bullet.bounce || 0;
    const cx = bullet.position.x + bullet.size.w / 2;
    const cy = bullet.position.y + bullet.size.h / 2;
    const r = Math.min(bullet.size.w, bullet.size.h) / 2;
    const fill =
      BULLET_COLORS[bounceCount % BULLET_COLORS.length] ?? palette.yellow;

    this.c.beginPath();
    this.c.arc(cx, cy, r, 0, Math.PI * 2);
    this.c.fillStyle = fill;
    this.c.fill();
    this.c.lineWidth = Math.max(2, r * 0.35);
    this.c.strokeStyle = INK;
    this.c.stroke();

    if (this.debugVisual) {
      this.c.beginPath();
      this.c.fillStyle = "rgba(255,0,0,0.4)";
      this.c.strokeStyle = "red";
      this.c.rect(
        bullet.position.x,
        bullet.position.y,
        bullet.size.w,
        bullet.size.h
      );
      this.c.fill();
      this.c.stroke();
    }
  }

  _drawPlayer(player: RenderPlayer, socketId: string) {
    if (player.alive) {
      // Shape-based arcade tank: treads + barrel + circle hull + ink outline.
      this._drawTank(player, socketId.includes("bot"));
    } else {
      this._drawWreck(player);
    }

    if (this.debugVisual) {
      this.c.beginPath();
      this.c.fillStyle = "rgba(255,0,0,0.4)";
      this.c.strokeStyle = "red";
      this.c.rect(
        player.position.x,
        player.position.y,
        player.size.w,
        player.size.h
      );
      this.c.fill();
      this.c.stroke();
    }
  }

  // Draw a tank via the shared shape fn so it matches the menu TankAvatar
  // exactly. The old turret sprite's art faced left at angle 0, so player.angle
  // is calibrated for a left-facing barrel; drawTank draws right-facing at
  // angle 0, hence the +PI flip.
  _drawTank(player: RenderPlayer, isBot: boolean) {
    drawTank(this.c, {
      cx: player.position.x + player.size.w / 2,
      cy: player.position.y + player.size.h / 2,
      r: Math.min(player.size.w, player.size.h) * 0.46,
      bodyColor: player.bodyc,
      turretColor: player.turretc,
      angle: player.angle + Math.PI,
      isBot,
    });
  }

  // A destroyed tank: a burnt-out husk that keeps the player's body hue (so you
  // can still tell who fell) but darkened, with a scorch blotch and cracks
  // radiating from the impact point.
  _drawWreck(player: RenderPlayer) {
    const c = this.c;
    const cx = player.position.x + player.size.w / 2;
    const cy = player.position.y + player.size.h / 2;
    const R = Math.min(player.size.w, player.size.h) * 0.4;
    const body = tankColors(player.bodyc);
    if (body.fill === "transparent") return;

    // Darkened, charred versions of the body colour — still the team hue, but
    // clearly burnt out. The hull uses WRECK_CHAR, the shared "burnt" darkness
    // the flying cannon (Debris) is charred to as well, so body + barrel match.
    const husk = mixHex(body.fill, INK, WRECK_CHAR);
    const scorch = mixHex(body.fill, INK, 0.82);

    c.save();
    c.lineJoin = "round";
    c.lineCap = "round";

    // Hull — same weight outline as the live tank so it sits right.
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.fillStyle = husk;
    c.fill();
    c.lineWidth = R * 0.22;
    c.strokeStyle = INK;
    c.stroke();

    // Everything below stays inside the hull.
    c.clip();

    // Off-centre scorch blotch for some depth.
    c.beginPath();
    c.arc(cx + R * 0.16, cy - R * 0.08, R * 0.55, 0, Math.PI * 2);
    c.fillStyle = scorch;
    c.fill();

    // Cracks: three kinked spokes from the impact point out to the rim.
    c.strokeStyle = INK;
    c.lineWidth = R * 0.13;
    const spokes = [-1.9, 0.5, 2.5];
    for (const a of spokes) {
      const mx = cx + Math.cos(a) * R * 0.5;
      const my = cy + Math.sin(a) * R * 0.5;
      const ex = cx + Math.cos(a + 0.3) * R;
      const ey = cy + Math.sin(a + 0.3) * R;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(mx, my);
      c.lineTo(ex, ey);
      c.stroke();
    }

    c.restore();
  }

  // Draw particles and shockwaves
  drawParticles(particles: DrawableEffect[], chockwaves: DrawableEffect[]) {
    // Draw particles
    if (particles) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        if (particle && particle.timealive < particle.timelife) {
          particle.draw(this.c);
        }
      }
    }

    // Draw shockwaves
    if (chockwaves) {
      for (let i = chockwaves.length - 1; i >= 0; i--) {
        const chockwave = chockwaves[i];
        if (chockwave && chockwave.timealive < chockwave.timelife) {
          chockwave.draw(this.c);
        }
      }
    }
  }
}
