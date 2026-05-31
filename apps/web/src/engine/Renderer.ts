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

const INK = palette.ink;
const GRID_CELL = 40;
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
  images: Record<string, HTMLImageElement>;
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

    // Image cache
    this.images = {};
    this._loadImages();

    // Pre-rendered graph-paper field; seeded onto the (persistent) fading
    // canvas so the grid is there from frame 0 and track trails fade into it.
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
    g.strokeStyle = palette.fieldLine;
    g.lineWidth = 2;
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
    return off;
  }

  // Paint the field at full opacity once so there is no grey "fade-in".
  _seedField() {
    if (this.fc && this.fieldImage) {
      this.fc.globalAlpha = 1;
      this.fc.drawImage(this.fieldImage, 0, 0, this.width, this.height);
    }
  }

  _loadImages() {
    // The arcade renderer draws tanks/blocks/bullets/holes as shapes, so the
    // only remaining raster assets are the track-trail decal and the dead
    // marker (both still blitted onto the fading canvas).
    this.images.body_tracks = this._loadImage(
      "ressources/image/tank_player/body_tracks.png"
    );
    this.images.dead = this._loadImage("ressources/image/dead.png");
  }

  _loadImage(src: string): HTMLImageElement {
    const img = new Image();
    img.src = src;
    return img;
  }

  // The theme number still drives gameplay elsewhere; the renderer no longer
  // swaps art per theme (everything is palette-driven), so this is a no-op kept
  // for the GameEngine.setTheme call site.
  setTheme(theme: number) {
    this.theme = theme;
  }

  clear() {
    this.c.clearRect(0, 0, this.width, this.height);
    // Re-paint the graph-paper field slightly each frame on the persistent
    // fading canvas: this both maintains the grid and gradually fades the
    // track trails drawn on top of it back into the field.
    if (this.fc && this.fieldImage) {
      this.fc.globalAlpha = 0.08;
      this.fc.drawImage(this.fieldImage, 0, 0, this.width, this.height);
      this.fc.globalAlpha = 1;
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
      blocks.forEach((block) => this._drawBlock(block));
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

  _drawBlock(block: Block) {
    // type 1 = wall (gray), type 2 = platform (tan). Flat fill + thick ink edge.
    const { x, y } = block.position;
    const { w, h } = block.size;
    const isWall = block.type === 1;
    const fill = isWall ? "#7d848e" : "#cbb287";
    const edge = isWall ? "#4c5057" : "#9c8556";
    const r = Math.min(w, h) * 0.16;

    this.c.beginPath();
    this.c.roundRect(x + 2, y + 2, w - 4, h - 4, r);
    this.c.fillStyle = fill;
    this.c.fill();
    this.c.lineWidth = 4;
    this.c.strokeStyle = INK;
    this.c.stroke();
    // subtle inner edge highlight
    this.c.lineWidth = 2;
    this.c.strokeStyle = edge;
    this.c.stroke();
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
      // Faint track trail on the persistent fading canvas.
      const tracksImg = this.images.body_tracks;
      if (this.fc && tracksImg && this.drawTicks % 15 === 0) {
        this._drawImageRot(
          this.fc,
          tracksImg,
          player.position.x,
          player.position.y,
          player.size.w,
          player.size.h,
          (player.rotation * Math.PI) / 180
        );
      }

      // Shape-based arcade tank: treads + barrel + circle hull + ink outline.
      this._drawTank(player, socketId.includes("bot"));
    } else {
      // Draw dead player
      const deadImg = this.images.dead;
      if (this.fc && deadImg) {
        this._drawImageRot(
          this.fc,
          deadImg,
          player.position.x,
          player.position.y,
          player.size.w,
          player.size.h,
          (player.rotation * Math.PI) / 180
        );
      }
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

  // Draw a tank as flat cartoon shapes (diep.io style), matching TankAvatar.
  _drawTank(player: RenderPlayer, isBot: boolean) {
    const c = this.c;
    const cx = player.position.x + player.size.w / 2;
    const cy = player.position.y + player.size.h / 2;
    const R = Math.min(player.size.w, player.size.h) * 0.46;
    const body = tankColors(player.bodyc);
    const turret = tankColors(player.turretc);
    if (body.fill === "transparent") return;

    c.save();
    c.lineJoin = "round";

    // Track plates, aligned to the hull's facing (body rotation, in degrees).
    const rot = (player.rotation * Math.PI) / 180;
    c.save();
    c.translate(cx, cy);
    c.rotate(rot);
    const tw = R * 0.5;
    const th = R * 1.8;
    c.fillStyle = "#9aa2ad";
    c.strokeStyle = INK;
    c.lineWidth = R * 0.16;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.roundRect(side * R * 0.95 - tw / 2, -th / 2, tw, th, tw * 0.4);
      c.fill();
      c.stroke();
    }
    c.restore();

    // Barrel, pointing along the turret angle (radians).
    const barrelLen = R * 1.55;
    const barrelW = R * 0.6;
    c.save();
    c.translate(cx, cy);
    c.rotate(player.angle);
    c.beginPath();
    c.roundRect(
      -R * 0.2,
      -barrelW / 2,
      barrelLen + R * 0.2,
      barrelW,
      barrelW * 0.25
    );
    c.fillStyle = turret.fill;
    c.lineWidth = R * 0.2;
    c.strokeStyle = INK;
    c.fill();
    c.stroke();
    c.restore();

    // Hull.
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.fillStyle = body.fill;
    c.fill();
    c.lineWidth = R * 0.24;
    c.strokeStyle = INK;
    c.stroke();

    // Centre hub.
    c.beginPath();
    c.arc(cx, cy, R * 0.3, 0, Math.PI * 2);
    c.fillStyle = "rgba(0,0,0,0.18)";
    c.fill();
    c.lineWidth = R * 0.1;
    c.strokeStyle = INK;
    c.stroke();

    // Bots get a dashed targeting ring so they read as AI.
    if (isBot) {
      c.beginPath();
      c.setLineDash([R * 0.35, R * 0.25]);
      c.arc(cx, cy, R * 0.66, 0, Math.PI * 2);
      c.lineWidth = R * 0.12;
      c.strokeStyle = INK;
      c.stroke();
      c.setLineDash([]);
    }

    c.restore();
  }

  _drawImageRot(
    ctx: CanvasRenderingContext2D,
    img: CanvasImageSource,
    x: number,
    y: number,
    width: number,
    height: number,
    rad: number
  ) {
    ctx.save();
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -width / 2, -height / 2, width, height);
    ctx.restore();
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
