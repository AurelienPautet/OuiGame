/**
 * PostProcessor — a WebGL post-processing layer on top of the 2D renderer.
 *
 * The game still renders exactly as before to two stacked 2D canvases (the
 * field on the back canvas, entities + particles on the front). Instead of
 * showing those directly, this uploads them as textures each frame, composites
 * them, and runs a small full-screen shader chain — radial **shockwaves** and
 * **bloom** today, with room for more passes — presenting the result on its own
 * WebGL canvas. The 2D drawing code is untouched; this is purely a screen-space
 * finishing stage.
 *
 * If WebGL is unavailable the constructor throws and the caller (GameEngine)
 * falls back to showing the plain 2D canvases.
 */
import { hexToRgb, palette } from "../theme/palette";
import type { EffectSettings } from "../lib/settings";
import {
  createSourceTexture,
  createTarget,
  Program,
  type GL,
  type RenderTarget,
} from "./postfx/gl";
import {
  BLUR_FRAG,
  BRIGHT_FRAG,
  COPY_FRAG,
  FIELD_FRAG,
  FINAL_FRAG,
  HOLE_FRAG,
  HOLE_VERT,
  MAX_SHOCKWAVES,
  OUTLINE_FRAG,
  OUTLINE_VERT,
  shockwaveFrag,
  VERT_SRC,
  WALL_FRAG,
  WALL_VERT,
} from "./postfx/shaders";

interface Vec2 {
  x: number;
  y: number;
}

/** A block (wall): board-space rect + type (1 = stone, else sand). */
export interface EnvBlock {
  position: { x: number; y: number };
  size: { w: number; h: number };
  type: number;
}

/** A hole (pit): board-space rect. */
export interface EnvHole {
  position: { x: number; y: number };
  size: { w: number; h: number };
}

interface Shockwave {
  cu: number; // centre u, 0..1
  cv: number; // centre v, 0..1 (flipped into texture space)
  birth: number; // performance.now() ms
  life: number; // ms
  amp: number; // peak displacement, UV units
}

// Bloom runs at a fraction of full resolution — cheap, and the blur hides the
// downscale entirely.
const BLOOM_SCALE = 0.25;

// Board base colour, used by the procedural field shader.
const FIELD = hexToRgb(palette.field);

// Wall fills (stone = type 1, sand = otherwise) and the ink outline colour —
// matching the 2D renderer's block colours exactly.
const WALL_STONE = hexToRgb("#7d848e");
const WALL_SAND = hexToRgb("#cbb287");
const INK = hexToRgb(palette.ink);

// Outline thickness (board px), matching the 2D block stroke (lineWidth 4).
const OUTLINE_PX = 4;

// Hole depth field: a distance-from-the-shore transform over the hole region,
// sampled (linearly) by the hole shader to merge tiles into one pit with depth.
// Resolution is a quarter-tile (12.5px) so the rim follows the hole shape, and
// MAX_PX is the distance at which a pit reads fully deep.
// Finer cells (5px) so the rounded, animated pit rim resolves smoothly.
const HOLE_CELL = 5;
const HOLE_DEPTH_MAX_PX = 40;

// Screen shake: peak whole-frame offset (UV units) at trauma = 1, and how long
// trauma takes to bleed off. Offset scales with trauma² so small knocks barely
// register and only big hits really kick.
const SHAKE_MAX = 0.018;
const SHAKE_DECAY_MS = 500;
// Death flash: how long the red vignette pulse takes to fade.
const FLASH_DECAY_MS = 550;
// Kill pop: a quick warm flash — short so rapid kills blink rather than wash.
const KILL_DECAY_MS = 220;

export class PostProcessor {
  private readonly gl: GL;
  private readonly canvas: HTMLCanvasElement;
  private readonly W: number;
  private readonly H: number;
  private readonly qW: number;
  private readonly qH: number;
  // Hole depth-field grid dimensions (board / HOLE_CELL).
  private readonly hgW: number;
  private readonly hgH: number;

  // GL objects (rebuilt on context restore).
  private quad: WebGLBuffer | null = null;
  private field!: Program;
  private holeP!: Program;
  private wallP!: Program;
  private outlineP!: Program;
  private copy!: Program;
  private shock!: Program;
  private bright!: Program;
  private blur!: Program;
  private final!: Program;
  // Environment geometry buffers, rebuilt each frame from the current blocks
  // and holes (block geometry changes as walls are destroyed).
  private holeBuf: WebGLBuffer | null = null;
  private wallFillBuf: WebGLBuffer | null = null;
  private wallOutlineBuf: WebGLBuffer | null = null;
  // Hole depth-field texture + the signature of the holes it was built from
  // (rebuilt only when the hole set changes — holes are static within a level).
  private holeDepthTex: WebGLTexture | null = null;
  private holeSig = "";
  private frontTex!: WebGLTexture;
  private scene!: RenderTarget;
  private warped!: RenderTarget;
  private brightT!: RenderTarget;
  private blurA!: RenderTarget;
  private blurB!: RenderTarget;

  private shockwaves: Shockwave[] = [];
  private lost = false;

  // Screen-shake "trauma" (0..1) and death-flash amount (0..1), both decaying
  // each frame. `lastFrame` timestamps the previous render for the decay dt.
  private trauma = 0;
  private flashAmt = 0;
  private killAmt = 0;
  private lastFrame = 0;

  // Tunable effect strengths.
  bloomStrength = 1.15;
  vignette = 0.08;
  aberration = 0.012;

  // Per-effect on/off, driven by user settings (setEffects). Only the passes
  // this stage owns are tracked here; particles/sound are gated elsewhere.
  // Bloom/vignette/aberration are zeroed in the final shader when off;
  // shockwaves and the shake/flash triggers are gated at their entry points.
  private fx = {
    bloom: true,
    screenShake: true,
    aberration: true,
    vignette: true,
    shockwaves: true,
    flashes: true,
    scenery: true,
  };

  /** Apply the user's effect toggles (the subset this stage owns). */
  setEffects(e: EffectSettings): void {
    this.fx = {
      bloom: e.bloom,
      screenShake: e.screenShake,
      aberration: e.aberration,
      vignette: e.vignette,
      shockwaves: e.shockwaves,
      flashes: e.flashes,
      scenery: e.scenery,
    };
  }

  private readonly onLost = (e: Event) => {
    e.preventDefault(); // keep the context recoverable
    this.lost = true;
  };
  private readonly onRestored = () => {
    this._build();
    this.lost = false;
  };

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.canvas = canvas;
    this.W = width;
    this.H = height;
    this.qW = Math.max(1, Math.floor(width * BLOOM_SCALE));
    this.qH = Math.max(1, Math.floor(height * BLOOM_SCALE));
    this.hgW = Math.max(1, Math.round(width / HOLE_CELL));
    this.hgH = Math.max(1, Math.round(height / HOLE_CELL));
    canvas.width = width;
    canvas.height = height;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    }) as WebGLRenderingContext | null;
    if (!gl) throw new Error("WebGL unavailable");
    this.gl = gl;

    canvas.addEventListener("webglcontextlost", this.onLost, false);
    canvas.addEventListener("webglcontextrestored", this.onRestored, false);

    this._build();
  }

  /** Build (or rebuild, after context loss) all GL resources. */
  private _build(): void {
    const gl = this.gl;

    const quad = gl.createBuffer();
    if (!quad) throw new Error("createBuffer failed");
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    // Two triangles covering clip space.
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    this.quad = quad;

    this.field = new Program(gl, VERT_SRC, FIELD_FRAG);
    this.copy = new Program(gl, VERT_SRC, COPY_FRAG);
    this.shock = new Program(gl, VERT_SRC, shockwaveFrag(MAX_SHOCKWAVES));
    this.bright = new Program(gl, VERT_SRC, BRIGHT_FRAG);
    this.blur = new Program(gl, VERT_SRC, BLUR_FRAG);
    this.final = new Program(gl, VERT_SRC, FINAL_FRAG);
    // Environment geometry programs (their own attribute layouts).
    this.holeP = new Program(gl, HOLE_VERT, HOLE_FRAG, ["aPos", "aBoard"]);
    this.wallP = new Program(gl, WALL_VERT, WALL_FRAG, [
      "aPos",
      "aBoard",
      "aType",
    ]);
    this.outlineP = new Program(gl, OUTLINE_VERT, OUTLINE_FRAG, ["aPos"]);

    this.holeBuf = gl.createBuffer();
    this.wallFillBuf = gl.createBuffer();
    this.wallOutlineBuf = gl.createBuffer();
    // Depth-field texture: linear-filtered so the per-cell distances smooth into
    // a continuous pit. Data is uploaded lazily by _ensureHoleDepth; reset the
    // signature so a fresh (or context-restored) texture re-uploads.
    this.holeDepthTex = createSourceTexture(gl);
    this.holeSig = "";

    this.frontTex = createSourceTexture(gl);
    this.scene = createTarget(gl, this.W, this.H);
    this.warped = createTarget(gl, this.W, this.H);
    this.brightT = createTarget(gl, this.qW, this.qH);
    this.blurA = createTarget(gl, this.qW, this.qH);
    this.blurB = createTarget(gl, this.qW, this.qH);

    // Seed the visible canvas with the board colour so there's no black flash
    // before the first rendered frame (the 2D path seeds the field the same way).
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
    gl.clearColor(FIELD.red / 255, FIELD.green / 255, FIELD.blue / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /** Queue a shockwave centred at a board-space (1150×800) position. */
  shockwave(pos: Vec2, amp = 0.05, life = 650): void {
    if (this.lost || !this.fx.shockwaves) return;
    this.shockwaves.push({
      cu: pos.x / this.W,
      cv: 1 - pos.y / this.H, // textures are uploaded Y-flipped (see _upload)
      birth: performance.now(),
      life,
      amp,
    });
    // Keep only the most recent few — the shader caps at MAX_SHOCKWAVES.
    if (this.shockwaves.length > MAX_SHOCKWAVES) this.shockwaves.shift();
  }

  /** Add screen-shake trauma (0..1). Stacks (capped) and decays automatically. */
  shake(trauma: number): void {
    if (this.lost || !this.fx.screenShake) return;
    this.trauma = Math.min(1, this.trauma + trauma);
  }

  /** Trigger the red death-flash (0..1). */
  flash(amount = 1): void {
    if (this.lost || !this.fx.flashes) return;
    this.flashAmt = Math.min(1, this.flashAmt + amount);
  }

  /** Trigger the warm "kill confirmed" pop (0..1). */
  killFlash(amount = 1): void {
    if (this.lost || !this.fx.flashes) return;
    this.killAmt = Math.min(1, this.killAmt + amount);
  }

  /**
   * Draw the procedural environment (animated field, holes, walls), composite
   * the entity layer over it, and run the effect chain, presenting to the WebGL
   * canvas. `front` is the 2D entity + particle canvas (transparent
   * background); the field/holes/walls are generated here in GL from `blocks`
   * and `holes` (the 2D renderer skips them while post is active). The 2D back
   * canvas / 2D environment are only used by the non-WebGL fallback.
   */
  render(front: HTMLCanvasElement, blocks: EnvBlock[], holes: EnvHole[]): void {
    if (this.lost) return;
    const gl = this.gl;
    const now = performance.now();
    // Freeze environment animation (but still draw it) when scenery is off.
    const animT = this.fx.scenery ? now / 1000 : 0;

    // Decay shake/flash by real elapsed time (clamped so a tab returning from
    // the background doesn't jump them straight to zero).
    const dt = this.lastFrame ? Math.min(now - this.lastFrame, 100) : 16;
    this.lastFrame = now;
    this.trauma = Math.max(0, this.trauma - dt / SHAKE_DECAY_MS);
    this.flashAmt = Math.max(0, this.flashAmt - dt / FLASH_DECAY_MS);
    this.killAmt = Math.max(0, this.killAmt - dt / KILL_DECAY_MS);

    this.shockwaves = this.shockwaves.filter((s) => now - s.birth < s.life);

    this._upload(this.frontTex, front);

    // 1a. Procedural animated field → scene (opaque base).
    this._bind(this.scene);
    gl.disable(gl.BLEND);
    this.field.use();
    gl.uniform2f(this.field.loc("uRes"), this.W, this.H);
    gl.uniform1f(this.field.loc("uTime"), animT);
    gl.uniform3f(
      this.field.loc("uField"),
      FIELD.red / 255,
      FIELD.green / 255,
      FIELD.blue / 255
    );
    this._drawFullscreen();

    // 1a2. Environment geometry (holes, then wall fills + ink outlines), drawn
    // opaque over the field — same z-order as the 2D renderer (holes < walls <
    // entities). Rebuilt from current geometry each frame.
    const env = this._buildEnv(blocks, holes);
    if (env.holeVerts > 0) {
      this._ensureHoleDepth(holes); // (re)build the depth field if holes changed
      this.holeP.use();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.holeDepthTex);
      gl.uniform1i(this.holeP.loc("uDepth"), 0);
      gl.uniform2f(this.holeP.loc("uTexel"), 1 / this.hgW, 1 / this.hgH);
      gl.uniform1f(this.holeP.loc("uTime"), animT);
      // Straight-alpha "over" the field so the rounded, animated rim shows the
      // floor through the corners.
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      this._drawHoles(env.holeVerts);
      gl.disable(gl.BLEND);
    }
    if (env.wallVerts > 0) {
      this.wallP.use();
      gl.uniform1f(this.wallP.loc("uTime"), animT);
      gl.uniform2f(this.wallP.loc("uRes"), this.W, this.H);
      gl.uniform3f(
        this.wallP.loc("uStone"),
        WALL_STONE.red / 255,
        WALL_STONE.green / 255,
        WALL_STONE.blue / 255
      );
      gl.uniform3f(
        this.wallP.loc("uSand"),
        WALL_SAND.red / 255,
        WALL_SAND.green / 255,
        WALL_SAND.blue / 255
      );
      this._drawWallFills(env.wallVerts);

      this.outlineP.use();
      gl.uniform3f(
        this.outlineP.loc("uColor"),
        INK.red / 255,
        INK.green / 255,
        INK.blue / 255
      );
      this._drawOutlines(env.outlineVerts);
    }

    // 1b. Composite the entity layer over the field. The 2D canvas is straight
    // alpha, premultiplied on upload, so composite "over" with ONE/1-src.
    this.copy.use();
    gl.uniform1i(this.copy.loc("uTex"), 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this._drawTex(this.frontTex);
    gl.disable(gl.BLEND);

    // 2. Shockwave displacement: scene → warped.
    this._bind(this.warped);
    this.shock.use();
    gl.uniform1i(this.shock.loc("uTex"), 0);
    gl.uniform1f(this.shock.loc("uAspect"), this.W / this.H);
    this._uploadShockwaveUniforms(now);
    this._drawTex(this.scene.tex);

    // 3. Bright pass (downsampled): warped → brightT.
    this._bind(this.brightT);
    this.bright.use();
    gl.uniform1i(this.bright.loc("uTex"), 0);
    this._drawTex(this.warped.tex);

    // 4. Separable blur: brightT → blurB (H) → blurA (V).
    this.blur.use();
    gl.uniform1i(this.blur.loc("uTex"), 0);
    gl.uniform2f(this.blur.loc("uTexel"), 1 / this.qW, 1 / this.qH);
    this._bind(this.blurB);
    gl.uniform2f(this.blur.loc("uDir"), 1, 0);
    this._drawTex(this.brightT.tex);
    this._bind(this.blurA);
    gl.uniform2f(this.blur.loc("uDir"), 0, 1);
    this._drawTex(this.blurB.tex);

    // 5. Final composite → screen.
    this._bind(null);
    this.final.use();
    gl.uniform1i(this.final.loc("uScene"), 0);
    gl.uniform1i(this.final.loc("uBloom"), 1);
    // Zero the strength of any disabled pass (cheaper than rebuilding shaders).
    gl.uniform1f(
      this.final.loc("uBloomStrength"),
      this.fx.bloom ? this.bloomStrength : 0
    );
    gl.uniform1f(
      this.final.loc("uVignette"),
      this.fx.vignette ? this.vignette : 0
    );
    gl.uniform1f(
      this.final.loc("uAberration"),
      this.fx.aberration ? this.aberration : 0
    );
    gl.uniform1f(this.final.loc("uDamage"), this.flashAmt);
    gl.uniform1f(this.final.loc("uKill"), this.killAmt);
    // Per-frame jitter offset, magnitude trauma² so only real hits kick.
    const s = this.trauma * this.trauma;
    const ox = (Math.random() * 2 - 1) * SHAKE_MAX * s;
    const oy = (Math.random() * 2 - 1) * SHAKE_MAX * s;
    gl.uniform2f(this.final.loc("uShake"), ox, oy);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.blurA.tex);
    this._drawTex(this.warped.tex); // binds unit 0 + draws
  }

  /**
   * Free all GL resources. The WebGL *context* is deliberately NOT lost: the
   * GL canvas element persists across games (replay / campaign-advance recreate
   * the engine on the same canvas), and a canvas only ever yields one context —
   * losing it here would hand the next PostProcessor a dead context. Deleting
   * the buffers/textures/programs frees the GPU memory; the bare context is
   * cheap to keep and is reused by `_build()` next game.
   */
  dispose(): void {
    const gl = this.gl;
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    for (const t of [
      this.scene,
      this.warped,
      this.brightT,
      this.blurA,
      this.blurB,
    ]) {
      if (t) {
        gl.deleteFramebuffer(t.fbo);
        gl.deleteTexture(t.tex);
      }
    }
    gl.deleteTexture(this.frontTex);
    if (this.quad) gl.deleteBuffer(this.quad);
    if (this.holeBuf) gl.deleteBuffer(this.holeBuf);
    if (this.wallFillBuf) gl.deleteBuffer(this.wallFillBuf);
    if (this.wallOutlineBuf) gl.deleteBuffer(this.wallOutlineBuf);
    if (this.holeDepthTex) gl.deleteTexture(this.holeDepthTex);
    this.field?.dispose();
    this.holeP?.dispose();
    this.wallP?.dispose();
    this.outlineP?.dispose();
    this.copy?.dispose();
    this.shock?.dispose();
    this.bright?.dispose();
    this.blur?.dispose();
    this.final?.dispose();
  }

  // --- internals ---

  private _upload(tex: WebGLTexture, src: TexImageSource): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // Y-flip so canvas-top maps to screen-top; premultiply so straight-alpha
    // canvas pixels composite correctly with ONE/ONE_MINUS_SRC_ALPHA.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  }

  private _uploadShockwaveUniforms(now: number): void {
    const gl = this.gl;
    const n = Math.min(this.shockwaves.length, MAX_SHOCKWAVES);
    gl.uniform1i(this.shock.loc("uCount"), n);
    if (n === 0) return;
    const centers = new Float32Array(MAX_SHOCKWAVES * 2);
    const ages = new Float32Array(MAX_SHOCKWAVES);
    const amps = new Float32Array(MAX_SHOCKWAVES);
    for (let i = 0; i < n; i++) {
      const s = this.shockwaves[i]!;
      centers[i * 2] = s.cu;
      centers[i * 2 + 1] = s.cv;
      ages[i] = Math.min(1, (now - s.birth) / s.life);
      amps[i] = s.amp;
    }
    gl.uniform2fv(this.shock.loc("uCenter"), centers);
    gl.uniform1fv(this.shock.loc("uAge"), ages);
    gl.uniform1fv(this.shock.loc("uAmp"), amps);
  }

  private _bind(target: RenderTarget | null): void {
    const gl = this.gl;
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.W, this.H);
    }
  }

  /** Draw the fullscreen quad with the current program (no texture binding). */
  private _drawFullscreen(): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    // The geometry passes enable attributes 1/2; make sure they're off for the
    // single-attribute fullscreen passes so stale pointers aren't read.
    gl.disableVertexAttribArray(1);
    gl.disableVertexAttribArray(2);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /** Bind `tex` to unit 0 and draw the fullscreen quad with the current program. */
  private _drawTex(tex: WebGLTexture): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    this._drawFullscreen();
  }

  /**
   * Rebuild the environment vertex buffers from the current blocks/holes and
   * upload them. Returns the vertex counts. Cheap enough to run every frame
   * (a few hundred floats), and always correct as walls get destroyed.
   *
   * Layouts: holes = [clipX, clipY, boardU, boardV]; wall fills = [clipX,
   * clipY, boardU, boardV, type]; outlines = [clipX, clipY].
   */
  private _buildEnv(
    blocks: EnvBlock[],
    holes: EnvHole[]
  ): { holeVerts: number; wallVerts: number; outlineVerts: number } {
    const gl = this.gl;
    const W = this.W;
    const H = this.H;
    const cx = (x: number) => (x / W) * 2 - 1;
    const cy = (y: number) => 1 - (y / H) * 2; // board-top → clip-top

    // Holes: a quad per pit, carrying a board-space UV so all tiles sample one
    // continuous depth field (no per-tile seams).
    const hole: number[] = [];
    for (const h of holes) {
      const { x, y } = h.position;
      const x1 = x + h.size.w;
      const y1 = y + h.size.h;
      const ax = cx(x);
      const bx = cx(x1);
      const ay = cy(y);
      const by = cy(y1);
      const u0 = x / W;
      const u1 = x1 / W;
      const v0 = y / H;
      const v1 = y1 / H;
      // prettier-ignore
      hole.push(
        ax, ay, u0, v0,  bx, ay, u1, v0,  ax, by, u0, v1,
        ax, by, u0, v1,  bx, ay, u1, v0,  bx, by, u1, v1
      );
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.holeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(hole), gl.DYNAMIC_DRAW);

    // Walls: a fill quad per block + ink outline quads on edges with no
    // same-type neighbour (matching the 2D renderer's merge behaviour).
    const fill: number[] = [];
    const line: number[] = [];
    const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
    const occ = new Map<string, number>();
    for (const b of blocks) occ.set(key(b.position.x, b.position.y), b.type);
    const has = (x: number, y: number, t: number) => occ.get(key(x, y)) === t;
    const O = OUTLINE_PX / 2;
    const pushLine = (x: number, y: number, w: number, h: number) => {
      const ax = cx(x);
      const bx = cx(x + w);
      const ay = cy(y);
      const by = cy(y + h);
      line.push(ax, ay, bx, ay, ax, by, ax, by, bx, ay, bx, by);
    };
    for (const b of blocks) {
      const { x, y } = b.position;
      const { w, h } = b.size;
      const t = b.type;
      const ax = cx(x);
      const bx = cx(x + w);
      const ay = cy(y);
      const by = cy(y + h);
      const u0 = x / W;
      const u1 = (x + w) / W;
      const v0 = y / H;
      const v1 = (y + h) / H;
      fill.push(
        ax,
        ay,
        u0,
        v0,
        t,
        bx,
        ay,
        u1,
        v0,
        t,
        ax,
        by,
        u0,
        v1,
        t,
        ax,
        by,
        u0,
        v1,
        t,
        bx,
        ay,
        u1,
        v0,
        t,
        bx,
        by,
        u1,
        v1,
        t
      );
      if (!has(x, y - h, t)) pushLine(x, y - O, w, OUTLINE_PX);
      if (!has(x + w, y, t)) pushLine(x + w - O, y, OUTLINE_PX, h);
      if (!has(x, y + h, t)) pushLine(x, y + h - O, w, OUTLINE_PX);
      if (!has(x - w, y, t)) pushLine(x - O, y, OUTLINE_PX, h);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.wallFillBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(fill), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.wallOutlineBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(line), gl.DYNAMIC_DRAW);

    return {
      holeVerts: hole.length / 4,
      wallVerts: fill.length / 5,
      outlineVerts: line.length / 2,
    };
  }

  /**
   * (Re)build the hole depth field when the hole set changes. Rasterises holes
   * onto a quarter-tile grid, runs a two-pass chamfer distance transform from
   * the "shore" (non-hole cells) so each hole cell holds its distance-to-edge,
   * normalises that to 0..1 depth, and uploads it as a linear-filtered texture.
   * The result merges adjacent hole tiles into one continuous pit with depth.
   */
  private _ensureHoleDepth(holes: EnvHole[]): void {
    const sig = holes
      .map((h) => `${h.position.x},${h.position.y},${h.size.w},${h.size.h}`)
      .join(";");
    if (sig === this.holeSig) return;
    this.holeSig = sig;

    const GW = this.hgW;
    const GH = this.hgH;
    const INF = 1e9;
    const dist = new Float32Array(GW * GH);
    // Seed: non-hole cells are the shore (0); hole cells start at infinity.
    for (let gy = 0; gy < GH; gy++) {
      for (let gx = 0; gx < GW; gx++) {
        const px = (gx + 0.5) * HOLE_CELL;
        const py = (gy + 0.5) * HOLE_CELL;
        let inside = false;
        for (const h of holes) {
          if (
            px >= h.position.x &&
            px < h.position.x + h.size.w &&
            py >= h.position.y &&
            py < h.position.y + h.size.h
          ) {
            inside = true;
            break;
          }
        }
        dist[gy * GW + gx] = inside ? INF : 0;
      }
    }
    // Two-pass chamfer (orthogonal cost 1, diagonal √2 ≈ near-Euclidean).
    const D = Math.SQRT2;
    const at = (x: number, y: number) => dist[y * GW + x]!;
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        let d = dist[y * GW + x]!;
        if (x > 0) d = Math.min(d, at(x - 1, y) + 1);
        if (y > 0) d = Math.min(d, at(x, y - 1) + 1);
        if (x > 0 && y > 0) d = Math.min(d, at(x - 1, y - 1) + D);
        if (x < GW - 1 && y > 0) d = Math.min(d, at(x + 1, y - 1) + D);
        dist[y * GW + x] = d;
      }
    }
    for (let y = GH - 1; y >= 0; y--) {
      for (let x = GW - 1; x >= 0; x--) {
        let d = dist[y * GW + x]!;
        if (x < GW - 1) d = Math.min(d, at(x + 1, y) + 1);
        if (y < GH - 1) d = Math.min(d, at(x, y + 1) + 1);
        if (x < GW - 1 && y < GH - 1) d = Math.min(d, at(x + 1, y + 1) + D);
        if (x > 0 && y < GH - 1) d = Math.min(d, at(x - 1, y + 1) + D);
        dist[y * GW + x] = d;
      }
    }
    // Normalise distance (cells → px → 0..1 depth) into a single-channel image.
    const data = new Uint8Array(GW * GH);
    for (let i = 0; i < data.length; i++) {
      const depthPx = dist[i]! * HOLE_CELL;
      data[i] = Math.max(
        0,
        Math.min(255, Math.round((depthPx / HOLE_DEPTH_MAX_PX) * 255))
      );
    }
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.holeDepthTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); // data is already board-oriented
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      GW,
      GH,
      0,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      data
    );
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); // restore default
  }

  private _drawHoles(verts: number): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.holeBuf);
    const stride = 4 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.disableVertexAttribArray(2);
    gl.drawArrays(gl.TRIANGLES, 0, verts);
  }

  private _drawWallFills(verts: number): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.wallFillBuf);
    const stride = 5 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 16);
    gl.drawArrays(gl.TRIANGLES, 0, verts);
  }

  private _drawOutlines(verts: number): void {
    if (verts === 0) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.wallOutlineBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disableVertexAttribArray(1);
    gl.disableVertexAttribArray(2);
    gl.drawArrays(gl.TRIANGLES, 0, verts);
  }
}

/**
 * Construct a PostProcessor, returning null (and warning) on any failure —
 * shared by the game (GameEngine) and the level editor so both fall back to
 * plain 2D rendering identically when WebGL is unavailable.
 */
export function tryCreatePostProcessor(
  glCanvas: HTMLCanvasElement,
  width: number,
  height: number
): PostProcessor | null {
  try {
    return new PostProcessor(glCanvas, width, height);
  } catch (err) {
    console.warn("Post-processing unavailable, using 2D canvas:", err);
    return null;
  }
}
