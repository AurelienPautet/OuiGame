import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { palette } from "../../theme/palette";

interface GameCursorProps {
  /** Reticle accent colour (resolved hex) — usually the player's turret colour. */
  color: string;
}

// Tick marks (x1,y1 → x2,y2) pointing inward at N / E / S / W on a 40×40 grid
// centred at (20,20).
const TICKS: ReadonlyArray<[number, number, number, number]> = [
  [20, 2.5, 20, 9],
  [37.5, 20, 31, 20],
  [20, 37.5, 20, 31],
  [2.5, 20, 9, 20],
];

/**
 * Custom in-game pointer — an arcade reticle that replaces the OS cursor during
 * play (GameCanvas hides the native cursor while this is mounted).
 *
 * It lives in the DOM rather than on the canvas so the WebGL post-processing
 * (bloom / shockwave) never warps or blooms it, and the surrounding stage's CSS
 * `scale` keeps it sized to the board automatically. Position is read straight
 * from `window.gameInput.aim` — the same value the simulation aims/fires toward
 * — so the reticle is pixel-locked to where shots actually go, and updates via a
 * rAF loop that mutates `style.transform` directly (no per-frame React render).
 */
export const GameCursor = ({ color }: GameCursorProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const reduce = useReducedMotion();

  // Follow the live aim point every frame.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const aim = window.gameInput?.aim;
      const el = wrapperRef.current;
      if (aim && el) {
        el.style.transform = `translate3d(${aim.x}px, ${aim.y}px, 0) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Quick "recoil" pop on fire (left mouse) for tactile feedback.
  useEffect(() => {
    if (reduce) return;
    const svg = svgRef.current;
    if (!svg) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      svg.style.transform = "scale(0.78)";
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        svg.style.transform = "scale(1)";
      }, 90);
    };
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("mousedown", onDown);
      if (timer) clearTimeout(timer);
    };
  }, [reduce]);

  return (
    <div
      ref={wrapperRef}
      className="pointer-events-none absolute left-0 top-0 z-20"
      style={{ willChange: "transform" }}
      aria-hidden
    >
      <svg
        ref={svgRef}
        width={40}
        height={40}
        viewBox="0 0 40 40"
        style={{ display: "block", transition: "transform 90ms ease-out" }}
      >
        {/* Ink halo behind so the reticle reads on the light field. */}
        <g
          fill="none"
          stroke={palette.ink}
          strokeWidth={6}
          strokeLinecap="round"
        >
          <circle cx={20} cy={20} r={12.5} />
          {TICKS.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </g>
        {/* Accent reticle on top. */}
        <g fill="none" stroke={color} strokeWidth={3} strokeLinecap="round">
          <circle cx={20} cy={20} r={12.5} />
          {TICKS.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </g>
        <circle
          cx={20}
          cy={20}
          r={2.6}
          fill={color}
          stroke={palette.ink}
          strokeWidth={1.6}
        />
      </svg>
    </div>
  );
};
