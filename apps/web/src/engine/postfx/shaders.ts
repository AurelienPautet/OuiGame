/**
 * GLSL ES 1.00 sources for the post-processing chain (PostProcessor.ts).
 *
 * Kept as plain template strings (no .glsl loader / vite plugin) so the build
 * stays untouched. The full chain per frame is:
 *
 *   composite layers ─▶ scene
 *   shockwave warp    ─▶ warped        (full res, radial UV displacement)
 *   bright pass       ─▶ bright (¼ res)
 *   blur H, blur V    ─▶ bloom  (¼ res, separable gaussian)
 *   final composite   ─▶ screen        (warped + bloom + vignette)
 */

// Fragment-shader precision preamble. We want highp: mediump's ~2^-10 relative
// resolution quantises the tiny UV offsets the chromatic-aberration and
// shockwave passes apply (a fraction of a texel), which on real mediump mobile
// GPUs turns a subtle ~1px edge fringe into a thick coloured band — the bright
// pink/red "border" that appears around the arena's top/bottom boundary walls
// on phones. Desktop GPUs already evaluate mediump at high precision, so this is
// a no-op there. The #ifdef falls back to mediump on the rare GPU without highp
// fragment support, keeping those devices working (just with the old fringe).
const FRAG_PRECISION = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif`;

// One attribute (clip-space position); UV is derived in the vertex shader so a
// single fullscreen-quad buffer feeds every program.
export const VERT_SRC = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// Straight blit — used to composite the entity layer over the field.
export const COPY_FRAG = `
${FRAG_PRECISION}
varying vec2 vUv;
uniform sampler2D uTex;
void main() {
  gl_FragColor = texture2D(uTex, vUv);
}
`;

/**
 * Procedural animated field — the game's background: the same flowing organic
 * fbm shape, but **posterized into flat cel-shaded grey tones with thin contour
 * outlines** so it matches the flat, ink-outlined cartoon look of the tanks and
 * walls (rather than a smooth realistic gradient). No hue — it never competes
 * with the team colours. Tune SCALE, LEVELS (number of flat tones), and CONTRAST.
 */
export const FIELD_FRAG = `
${FRAG_PRECISION}
varying vec2 vUv;
uniform vec2 uRes;     // board pixels (1150 x 800)
uniform float uTime;   // seconds
uniform vec3 uField;   // base colour

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);   // scale + rotate per octave (less blocky)
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0) * 3.5;   // SCALE
  float t = uTime * 0.03;

  // Domain warp → flowing organic shape.
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t * 0.8));
  float n = fbm(p + 1.6 * q + t * 0.25);            // ~0..1

  // Posterize into a few FLAT grey tones (cel-shaded), no hue. Base is the board
  // colour pushed toward white for a lighter floor (WHITEN).
  float LEVELS = 4.0;
  float step = floor(clamp(n, 0.0, 0.999) * LEVELS) / (LEVELS - 1.0); // 0,.33,.67,1
  vec3 base = mix(uField, vec3(1.0), 0.7);          // WHITEN
  vec3 col = base + (step - 0.5) * 0.03;            // CONTRAST

  // Thin darker contour line at each tone boundary — a cartoon "ink" outline
  // tracing the organic patches, like the tanks/walls.
  float b = fract(n * LEVELS);
  col -= (1.0 - smoothstep(0.0, 0.05, min(b, 1.0 - b))) * 0.007;

  // Soft edge vignette for arena depth.
  col -= smoothstep(0.25, 0.80, length((vUv - 0.5) * vec2(aspect, 1.0))) * 0.05;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * Holes — plain black for now. The shared depth-field texture still gives the
 * continuous, rounded, gently-wobbling, block-sized shape (adjacent tiles merge
 * into one pit); the interior is just flat black via the alpha mask.
 */
export const HOLE_VERT = `
attribute vec2 aPos;
attribute vec2 aBoard;
varying vec2 vBoard;
void main() {
  vBoard = aBoard;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const HOLE_FRAG = `
${FRAG_PRECISION}
varying vec2 vBoard;
uniform sampler2D uDepth;  // 0 at the rim → 1 deep (continuous, linear-filtered)
uniform vec2 uTexel;       // unused (kept for the shared geometry layout)
uniform float uTime;
void main() {
  float d = texture2D(uDepth, vBoard).r;            // 0 rim → 1 deep

  // The pit boundary is a depth iso-contour. Inset is kept tiny so the hole
  // fills its tile like a wall block (not thinner) — just the corners round
  // slightly and a flowing wobble makes the rim ripple.
  float wob = sin(vBoard.x * 42.0 + uTime * 1.6)
            * sin(vBoard.y * 34.0 - uTime * 1.3) * 0.03;
  float edge = 0.04 + wob;
  float alpha = smoothstep(edge - 0.025, edge + 0.025, d);

  // Plain black for now.
  gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
}
`;

/**
 * Walls — block fills + ink outline in a single pass, with the animation keyed
 * off the block type so the two read very differently (board-space UV keeps both
 * seamless across merged blocks). Type 1 = STRONG / indestructible: solid steel,
 * mostly static, a fine brushed grain + a slow glint. Type 2 = DESTRUCTIBLE:
 * scrolling diagonal hazard stripes, signalling "this can be broken".
 *
 * Each tile is drawn as its quad expanded by a margin, and the fragment shader
 * builds the *local* rounded silhouette of the merged wall region analytically
 * from the tile's neighbour flags (no per-region distance field needed):
 *  - covered sides (a same-type neighbour abuts) are extended out by the radius,
 *    so the silhouette/ink sits on the outer edges only and merged runs are flush
 *    with no interior seam;
 *  - convex corners (both edges open) are rounded *outward*;
 *  - concave corners (both edges covered but the diagonal is open) are carved
 *    *inward* into the open diagonal as a fillet, so inner corners round too.
 * Because each tile only ever paints its own cell plus the unclaimed open space
 * at its own corners, neighbouring expanded quads never fight over a pixel.
 */
export const WALL_VERT = `
attribute vec2 aPos;
attribute float aType;
attribute vec4 aRect;   // (minX, minY, w, h) board px
attribute vec4 aExp;    // (top, right, bottom, left) 1 = edge open (no same-type neighbour)
attribute vec4 aDiag;   // (TR, BR, BL, TL) 1 = same-type diagonal neighbour present
varying float vType;
varying vec4 vRect;
varying vec4 vExp;
varying vec4 vDiag;
void main() {
  vType = aType;
  vRect = aRect;
  vExp = aExp;
  vDiag = aDiag;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const WALL_FRAG = `
${FRAG_PRECISION}
varying float vType;
varying vec4 vRect;     // (minX, minY, w, h) board px
varying vec4 vExp;      // (top, right, bottom, left) open edges
varying vec4 vDiag;     // (TR, BR, BL, TL) diagonal present
uniform float uTime;
uniform vec2 uRes;
uniform vec3 uStone;
uniform vec3 uSand;
uniform vec3 uInk;
uniform float uRadius;   // corner radius, board px
uniform float uOutline;  // ink thickness, board px

// Subtract an open diagonal cell from the wall SDF, giving a rounded inner corner.
// g>0 points into the diagonal cell; we subtract the cell with its corner (at the
// tile corner) pre-rounded by k, so the result is a plain max() of real SDFs — the
// fillet stays correct no matter how deep inside the tile the base distance is
// (a smooth-min degrades on all-covered tiles, where the base is hugely negative).
float fillet(float d, vec2 g, float k) {
  vec2 q = vec2(k) - g;                       // rounded-quadrant (cell) SDF, <0 inside
  float cell = min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - k;
  return max(d, -cell);
}

void main() {
  // Board px straight from the fragment position (the wall pass renders into the
  // full-board target; gl_FragCoord origin is bottom-left, board y runs down).
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);

  vec3 col;
  if (vType < 1.5) {
    // STRONG: solid steel — fine brushed grain + a slow broad glint.
    col = uStone;
    col += 0.02 * sin(px.y * 0.6);
    col += 0.035 * smoothstep(0.55, 1.0, sin((px.x - px.y) * 0.02 - uTime * 0.25));
  } else {
    // DESTRUCTIBLE: scrolling diagonal hazard stripes (~35px, moving).
    float stripe = sin((px.x + px.y) * 0.18 - uTime * 2.2);
    col = mix(uSand * 0.80, uSand, smoothstep(-0.2, 0.5, stripe));
    col += 0.06 * smoothstep(0.82, 1.0, stripe);  // bright crest on each stripe
  }

  vec2 sz = vRect.zw;
  vec2 c = (px - vRect.xy) - sz * 0.5;   // centred in the tile (x right, y down)
  vec2 b = sz * 0.5;
  float r = min(uRadius, 0.5 * min(sz.x, sz.y));

  // Open (silhouette) vs covered (neighbour abuts) per edge.
  float eT = vExp.x, eR = vExp.y, eB = vExp.z, eL = vExp.w;
  float cT = 1.0 - eT, cR = 1.0 - eR, cB = 1.0 - eB, cL = 1.0 - eL;

  // SDF of the local merged wall. Only OPEN edges constrain the region; a covered
  // edge is left unbounded so the wall flows seamlessly into its neighbour — the
  // silhouette and ink then live purely on open edges, identical for every tile
  // along a straight run (no per-tile seam/notch). qx/qy are the signed outside-
  // distance in each axis (negative = unconstrained on that side).
  float OUT = -1e4;
  float qx = max((eL > 0.5) ? (-b.x - c.x) : OUT, (eR > 0.5) ? (c.x - b.x) : OUT);
  float qy = max((eT > 0.5) ? (-b.y - c.y) : OUT, (eB > 0.5) ? (c.y - b.y) : OUT);
  // Rounded-box combine: convex corners (both axes constrained) round by r.
  vec2 aa = vec2(qx, qy) + r;
  float d = min(max(aa.x, aa.y), 0.0) + length(max(aa, 0.0)) - r;

  // Concave corners: where two covered edges meet an OPEN diagonal, the region
  // would overrun into that empty diagonal cell, so subtract the cell with its
  // corner rounded by r — that rounded subtraction is the inner-corner fillet.
  // g>0 points into the diagonal cell.
  if (cT * cR * (1.0 - vDiag.x) > 0.5) d = fillet(d, vec2(c.x - b.x, -b.y - c.y), r); // TR
  if (cB * cR * (1.0 - vDiag.y) > 0.5) d = fillet(d, vec2(c.x - b.x,  c.y - b.y), r); // BR
  if (cB * cL * (1.0 - vDiag.z) > 0.5) d = fillet(d, vec2(-b.x - c.x, c.y - b.y), r); // BL
  if (cT * cL * (1.0 - vDiag.w) > 0.5) d = fillet(d, vec2(-b.x - c.x, -b.y - c.y), r); // TL

  float fillA = 1.0 - smoothstep(-1.0, 1.0, d);
  float ht = uOutline * 0.5;
  float ink = 1.0 - smoothstep(ht - 1.0, ht + 1.0, abs(d));  // straddles the silhouette

  // An open edge runs unbounded into its covered neighbour, which is right for a
  // straight corridor — but at a junction that overshoots past the perpendicular
  // covered edge into the merged *interior* (e.g. a cross arm's side ink crossing
  // the centre), leaving a stray nub the neighbour can't always overdraw. Kill the
  // ink there: an open edge that has crossed a covered edge into a cell whose
  // diagonal is filled is interior, not silhouette. Gated on the diagonal, so a
  // real corridor (diagonal empty) is never touched — no seam returns.
  float pastL = 1.0 - smoothstep(-b.x - 1.0, -b.x + 1.0, c.x);
  float pastR = smoothstep(b.x - 1.0, b.x + 1.0, c.x);
  float pastT = 1.0 - smoothstep(-b.y - 1.0, -b.y + 1.0, c.y);
  float pastB = smoothstep(b.y - 1.0, b.y + 1.0, c.y);
  float sup = 0.0;
  sup = max(sup, eT * cL * vDiag.w * pastL);  // top edge, past covered left, TL filled
  sup = max(sup, eT * cR * vDiag.x * pastR);  // top edge, past covered right, TR filled
  sup = max(sup, eB * cL * vDiag.z * pastL);  // bottom, BL
  sup = max(sup, eB * cR * vDiag.y * pastR);  // bottom, BR
  sup = max(sup, eL * cT * vDiag.w * pastT);  // left edge, past covered top, TL
  sup = max(sup, eL * cB * vDiag.z * pastB);  // left, BL
  sup = max(sup, eR * cT * vDiag.x * pastT);  // right, TR
  sup = max(sup, eR * cB * vDiag.y * pastB);  // right, BR
  ink *= 1.0 - sup;

  col = mix(col, uInk, ink);
  float a = max(fillA, ink);
  if (a <= 0.004) discard;
  gl_FragColor = vec4(col, a);
}
`;

export const MAX_SHOCKWAVES = 8;

/**
 * Radial UV displacement: each active explosion pushes pixels outward in a thin
 * expanding gaussian ring whose amplitude decays as it grows — a refraction
 * shockwave. Distance is measured in aspect-corrected space so rings stay round
 * on the 1150×800 (non-square) board.
 */
export function shockwaveFrag(max: number): string {
  return `
${FRAG_PRECISION}
#define MAX ${max}
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uAspect;        // width / height
uniform int uCount;
uniform vec2 uCenter[MAX];    // explosion centres, UV space (v already flipped)
uniform float uAge[MAX];      // 0..1 normalised progress
uniform float uAmp[MAX];      // peak displacement, UV units
void main() {
  vec2 uv = vUv;
  vec2 disp = vec2(0.0);
  for (int i = 0; i < MAX; i++) {
    if (i >= uCount) break;
    vec2 toC = uv - uCenter[i];
    float ud = length(toC);
    vec2 ac = vec2(toC.x * uAspect, toC.y);  // aspect-correct for a round ring
    float dist = length(ac);
    float prog = uAge[i];
    float radius = prog * 0.9;                // ring sweeps out to ~0.9
    float ring = dist - radius;
    float band = 0.06;
    float w = exp(-(ring * ring) / (band * band));
    float amp = uAmp[i] * (1.0 - prog);       // fades as it expands
    vec2 dir = ud > 1e-4 ? toC / ud : vec2(0.0);
    disp += dir * w * amp;
  }
  gl_FragColor = texture2D(uTex, uv + disp);
}
`;
}

/**
 * Bright pass for bloom. The arcade board is a LIGHT grey field (~0.8
 * luminance), so a plain luminance threshold would bloom the whole background.
 * Instead this isolates two things the field is not: near-white pixels (spark
 * flashes) and bright *saturated* pixels (neon tank hulls, warm bullets /
 * debris). The low-saturation grey field and stone/sand blocks score ~0.
 */
export const BRIGHT_FRAG = `
${FRAG_PRECISION}
varying vec2 vUv;
uniform sampler2D uTex;
void main() {
  vec3 col = texture2D(uTex, vUv).rgb;
  float mx = max(col.r, max(col.g, col.b));
  float mn = min(col.r, min(col.g, col.b));
  float sat = (mx - mn) / max(mx, 1e-4);
  float white = smoothstep(0.95, 1.0, mx);                       // spark flashes
  float neon = smoothstep(0.45, 0.9, mx) * smoothstep(0.35, 0.75, sat);
  float score = clamp(white + neon, 0.0, 1.0);
  gl_FragColor = vec4(col * score, 1.0);
}
`;

// Separable 9-tap gaussian using linear-sampled tap pairs (5 fetches).
export const BLUR_FRAG = `
${FRAG_PRECISION}
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;   // 1 / target size
uniform vec2 uDir;     // (1,0) horizontal or (0,1) vertical
void main() {
  vec2 o = uTexel * uDir;
  vec4 sum = texture2D(uTex, vUv) * 0.227027;
  sum += texture2D(uTex, vUv + o * 1.384615) * 0.316216;
  sum += texture2D(uTex, vUv - o * 1.384615) * 0.316216;
  sum += texture2D(uTex, vUv + o * 3.230769) * 0.070270;
  sum += texture2D(uTex, vUv - o * 3.230769) * 0.070270;
  gl_FragColor = sum;
}
`;

// Final tone pass. Combines, in screen space:
//   - screen shake   (uShake: a whole-frame UV offset)
//   - chromatic aberration (uAberration: R/B split growing toward the edges)
//   - additive bloom + dark vignette
//   - death flash    (uDamage: a red vignette pulse, clear in the centre)
export const FINAL_FRAG = `
${FRAG_PRECISION}
varying vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uVignette;
uniform vec2 uShake;        // whole-frame UV offset
uniform float uAberration;  // RGB-split strength
uniform float uDamage;      // 0..1 red death-flash
uniform float uKill;        // 0..1 warm kill-confirmed pop
void main() {
  vec2 uv = vUv + uShake;
  vec2 d = uv - 0.5;
  float r2 = dot(d, d);

  // Chromatic aberration: push red out / blue in, scaled by distance² so the
  // centre stays sharp and the fringe lives at the edges.
  float amt = uAberration * r2;
  vec3 scene;
  scene.r = texture2D(uScene, uv + d * amt).r;
  scene.g = texture2D(uScene, uv).g;
  scene.b = texture2D(uScene, uv - d * amt).b;

  vec3 bloom = texture2D(uBloom, uv).rgb;
  vec3 col = scene + bloom * uBloomStrength;

  float vig = 1.0 - uVignette * r2 * 1.8;
  col *= clamp(vig, 0.0, 1.0);

  // Red edges flash on death; centre stays readable.
  float edge = smoothstep(0.05, 0.5, r2);
  col = mix(col, vec3(0.85, 0.06, 0.06), clamp(uDamage * edge, 0.0, 1.0));

  // Kill-confirmed: a brief warm additive pop across the whole frame.
  col += vec3(1.0, 0.88, 0.55) * uKill * 0.45;

  gl_FragColor = vec4(col, 1.0);
}
`;
