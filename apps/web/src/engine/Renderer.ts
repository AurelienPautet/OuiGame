/**
 * Renderer - Handles all canvas drawing for the game
 * Draws tanks, bullets, mines, blocks, and effects
 *
 * Visuals are the "diep.io arcade" style: a light graph-paper field, flat
 * cartoon shapes with thick dark outlines, team colours — all drawn
 * programmatically (no per-colour sprite sheets). Colours come from the shared
 * theme/palette so the canvas matches the DOM (TankAvatar etc.).
 */
import { palette, tankColors } from "../theme/palette";
import { drawTank } from "./tankShape";

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
    g.fillStyle = palette.field;
    g.fillRect(0, 0, this.width, this.height);
    // Faint 1px grid: reads as texture, not a hard lattice. Low-alpha so it
    // sits quietly behind tanks/blocks while still hinting scale + movement.
    g.strokeStyle = palette.fieldLine;
    g.globalAlpha = 0.4;
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= this.width; x += GRID_CELL) {
      g.moveTo(x, 0);
      g.lineTo(x, this.height);
    }
    for (let y = 0; y <= this.height; y += GRID_CELL) {
      g.moveTo(0, y);
      g.lineTo(this.width, y);
    }
    g.stroke();
    g.globalAlpha = 1;
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
    // Near-black rounded pit with a thick ink rim.
    const r = Math.min(h.size.w, h.size.h) * 0.18;
    this.c.beginPath();
    this.c.roundRect(h.position.x, h.position.y, h.size.w, h.size.h, r);
    this.c.fillStyle = "#13161b";
    this.c.fill();
    this.c.lineWidth = 4;
    this.c.strokeStyle = "#000";
    this.c.stroke();

    if (this.debugVisual) {
      this.c.beginPath();
      this.c.fillStyle = "rgba(255,0,0,0.4)";
      this.c.strokeStyle = "red";
      this.c.rect(h.position.x, h.position.y, h.size.w, h.size.h);
      this.c.fill();
      this.c.stroke();
    }
  }

  // Draw all blocks so adjacent same-type blocks merge into one solid shape:
  // fills are flush (no inset/rounding) so neighbours tile seamlessly, and the
  // thick ink outline is stroked ONLY on edges that face empty space.
  _drawBlocks(blocks: Block[]) {
    const c = this.c;
    // Occupancy map keyed by quantised top-left → block type, so we can ask
    // "is there a same-type block touching this edge?".
    const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
    const occ = new Map<string, number>();
    for (const b of blocks) {
      occ.set(key(b.position.x, b.position.y), b.type);
    }

    // Pass 1 — flush fills (adjacent blocks merge with no seam).
    for (const b of blocks) {
      c.fillStyle = b.type === 1 ? "#7d848e" : "#cbb287";
      c.fillRect(b.position.x, b.position.y, b.size.w, b.size.h);
    }

    // Pass 2 — ink outline only on exposed (no same-type neighbour) edges.
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.lineCap = "square";
    for (const b of blocks) {
      const { x, y } = b.position;
      const { w, h } = b.size;
      const t = b.type;
      const has = (nx: number, ny: number) => occ.get(key(nx, ny)) === t;
      c.beginPath();
      if (!has(x, y - h)) {
        c.moveTo(x, y);
        c.lineTo(x + w, y);
      }
      if (!has(x + w, y)) {
        c.moveTo(x + w, y);
        c.lineTo(x + w, y + h);
      }
      if (!has(x, y + h)) {
        c.moveTo(x + w, y + h);
        c.lineTo(x, y + h);
      }
      if (!has(x - w, y)) {
        c.moveTo(x, y + h);
        c.lineTo(x, y);
      }
      c.stroke();
    }
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

  // A destroyed tank: a desaturated hull with a dark X.
  _drawWreck(player: RenderPlayer) {
    const c = this.c;
    const cx = player.position.x + player.size.w / 2;
    const cy = player.position.y + player.size.h / 2;
    const R = Math.min(player.size.w, player.size.h) * 0.4;
    if (tankColors(player.bodyc).fill === "transparent") return;

    c.save();
    c.lineJoin = "round";
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.fillStyle = "#8b9097";
    c.fill();
    c.lineWidth = R * 0.2;
    c.strokeStyle = INK;
    c.stroke();

    c.lineWidth = R * 0.22;
    c.lineCap = "round";
    const d = R * 0.45;
    c.beginPath();
    c.moveTo(cx - d, cy - d);
    c.lineTo(cx + d, cy + d);
    c.moveTo(cx + d, cy - d);
    c.lineTo(cx - d, cy + d);
    c.stroke();
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
