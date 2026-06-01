/**
 * Minimal WebGL1 helpers for the post-processing pipeline (PostProcessor.ts).
 *
 * Raw WebGL on purpose — no three.js / regl / pixi — so the static itch.io
 * bundle stays small and the dependency surface unchanged. WebGL1 (GLSL ES
 * 1.00) is the lowest common denominator and works everywhere the game does;
 * the pipeline only ever needs RGBA8 framebuffers, so no float-texture
 * extensions are required.
 */

export type GL = WebGLRenderingContext;

/** An offscreen render target: a framebuffer backed by a colour texture. */
export interface RenderTarget {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

function compileShader(gl: GL, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("createShader failed");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`shader compile failed: ${log ?? "unknown"}`);
  }
  return sh;
}

/**
 * A linked program with a lazy uniform-location cache. Attributes are bound to
 * sequential locations (0, 1, 2…) in the order given — `["aPos"]` by default,
 * matching the shared fullscreen-quad buffer, or e.g. `["aPos","aLocal"]` for
 * the geometry passes (holes/walls).
 */
export class Program {
  readonly program: WebGLProgram;
  private readonly gl: GL;
  private readonly locs = new Map<string, WebGLUniformLocation | null>();

  constructor(
    gl: GL,
    vsSrc: string,
    fsSrc: string,
    attribs: string[] = ["aPos"]
  ) {
    this.gl = gl;
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    const program = gl.createProgram();
    if (!program) throw new Error("createProgram failed");
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    attribs.forEach((name, i) => gl.bindAttribLocation(program, i, name));
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`program link failed: ${log ?? "unknown"}`);
    }
    this.program = program;
  }

  use(): void {
    this.gl.useProgram(this.program);
  }

  /** Cached getUniformLocation. `null` (uniform absent/optimised out) is fine —
   * gl.uniform* with a null location is a silent no-op. */
  loc(name: string): WebGLUniformLocation | null {
    let l = this.locs.get(name);
    if (l === undefined) {
      l = this.gl.getUniformLocation(this.program, name);
      this.locs.set(name, l);
    }
    return l;
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
  }
}

// NPOT-safe sampling params (the canvas is 1150×800): clamp + linear, no
// mipmaps — required for non-power-of-two textures in WebGL1.
function setSamplingParams(gl: GL): void {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

/** A texture re-uploaded each frame from a 2D canvas (the game's rendered layers). */
export function createSourceTexture(gl: GL): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error("createTexture failed");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  setSamplingParams(gl);
  return tex;
}

/** An offscreen RGBA8 framebuffer + texture pair at the given size. */
export function createTarget(gl: GL, w: number, h: number): RenderTarget {
  const tex = gl.createTexture();
  if (!tex) throw new Error("createTexture failed");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    w,
    h,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  setSamplingParams(gl);

  const fbo = gl.createFramebuffer();
  if (!fbo) throw new Error("createFramebuffer failed");
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    tex,
    0
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex, w, h };
}
