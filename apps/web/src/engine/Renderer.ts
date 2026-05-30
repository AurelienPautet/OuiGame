/**
 * Renderer - Handles all canvas drawing for the game
 * Draws tanks, bullets, mines, blocks, and effects
 */
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
  }

  _loadImages() {
    const colors = [
      "blue",
      "orange",
      "red",
      "green",
      "violet",
      "yellow",
      "blueF",
      "turquoise",
      "violetF",
    ];

    // Load tank images
    colors.forEach((color) => {
      this.images[`body_${color}`] = this._loadImage(
        `ressources/image/tank_player/body_${color}.png`
      );
      this.images[`turret_${color}`] = this._loadImage(
        `ressources/image/tank_player/turret_${color}.png`
      );
    });

    // Load other images
    this.images.body_tracks = this._loadImage(
      "ressources/image/tank_player/body_tracks.png"
    );
    this.images.turret_decalc_bot = this._loadImage(
      "ressources/image/tank_player/turret_decalc_bot.png"
    );
    this.images.dead = this._loadImage("ressources/image/dead.png");
    this.images.hole = this._loadImage("ressources/image/block/hole.png");
    this.images.flag = this._loadImage("ressources/image/block/flag.png");

    // Theme-based images
    this._loadThemeImages(this.theme);
  }

  _loadImage(src: string): HTMLImageElement {
    const img = new Image();
    img.src = src;
    return img;
  }

  _loadThemeImages(theme: number) {
    this.images.block1 = this._loadImage(
      `ressources/image/block/Cube${theme}-1.png`
    );
    this.images.block2 = this._loadImage(
      `ressources/image/block/Cube${theme}-2.png`
    );
    this.images.bullet = this._loadImage(
      `ressources/image/bullet/bullet-${theme}.png`
    );
    this.images.bg = this._loadImage(`ressources/image/bg${theme}.png`);
  }

  setTheme(theme: number) {
    this.theme = theme;
    this._loadThemeImages(theme);
  }

  clear() {
    this.c.clearRect(0, 0, this.width, this.height);
    if (this.fc) {
      this.fc.globalAlpha = 0.05;
      this.fc.drawImage(this.images.bg, 0, 0, this.width, this.height);
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
      Object.keys(players).forEach((socketId) => {
        this._drawPlayer(players[socketId], socketId);
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
    this.c.closePath();
  }

  _drawHole(h: Hole) {
    this.c.drawImage(
      this.images.hole,
      h.position.x,
      h.position.y,
      h.size.w,
      h.size.h
    );

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
    const img = block.type === 1 ? this.images.block1 : this.images.block2;
    this.c.drawImage(
      img,
      block.position.x,
      block.position.y,
      block.size.w,
      block.size.h
    );
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
    const hueRotation = bounceCount * -30;

    this.c.save();
    if (bounceCount > 0) {
      this.c.filter = `hue-rotate(${hueRotation}deg)`;
    }

    this._drawImageRot(
      this.c,
      this.images.bullet,
      bullet.position.x,
      bullet.position.y,
      bullet.size.w,
      bullet.size.h,
      bullet.angle
    );

    this.c.restore();

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
      // Draw body
      const bodyImg = this.images[`body_${player.bodyc}`];
      if (bodyImg) {
        this._drawImageRot(
          this.c,
          bodyImg,
          player.position.x,
          player.position.y,
          player.size.w,
          player.size.h,
          (player.rotation * Math.PI) / 180
        );
      }

      // Draw tracks on fading canvas
      if (this.fc && this.drawTicks % 15 === 0) {
        this._drawImageRot(
          this.fc,
          this.images.body_tracks,
          player.position.x,
          player.position.y,
          player.size.w,
          player.size.h,
          (player.rotation * Math.PI) / 180
        );
      }

      // Draw turret
      const turretImg = this.images[`turret_${player.turretc}`];
      if (turretImg) {
        this._drawTurretRot(
          turretImg,
          player.position.x,
          player.position.y,
          player.turretsize.w,
          player.turretsize.h,
          player.angle
        );
      }

      // Draw bot marker
      if (socketId.includes("bot")) {
        this._drawTurretRot(
          this.images.turret_decalc_bot,
          player.position.x,
          player.position.y,
          player.turretsize.w,
          player.turretsize.h,
          player.angle
        );
      }
    } else {
      // Draw dead player
      if (this.fc) {
        this._drawImageRot(
          this.fc,
          this.images.dead,
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

  _drawTurretRot(
    img: CanvasImageSource,
    x: number,
    y: number,
    width: number,
    height: number,
    rad: number
  ) {
    this.c.save();
    this.c.translate(x + 0.4 * width, y + height * 0.6);
    this.c.rotate(rad);
    this.c.drawImage(img, -0.75 * width, -height / 2, width, height);
    this.c.restore();
  }

  // Draw particles and shockwaves
  drawParticles(particles: DrawableEffect[], chockwaves: DrawableEffect[]) {
    // Draw particles
    if (particles) {
      for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].timealive < particles[i].timelife) {
          particles[i].draw(this.c);
        }
      }
    }

    // Draw shockwaves
    if (chockwaves) {
      for (let i = chockwaves.length - 1; i >= 0; i--) {
        if (chockwaves[i].timealive < chockwaves[i].timelife) {
          chockwaves[i].draw(this.c);
        }
      }
    }
  }
}
