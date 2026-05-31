import { useEffect, useRef } from "react";
import { isHiddenTank } from "../../../theme/palette";
import { drawTank } from "../../../engine/tankShape";

interface TankAvatarProps {
  /** Hull colour NAME (see constants/tankColors.ts). */
  bodyColor: string;
  /** Barrel colour NAME; defaults to the body colour. */
  turretColor?: string;
  /** Rendered px size (square). */
  size?: number;
  /** Barrel direction in radians; defaults to pointing up. */
  angle?: number;
  className?: string;
  /** Accessible label; falls back to "tank". */
  title?: string;
}

/**
 * The menu tank. Renders via the SAME `drawTank` routine the in-game engine
 * uses (engine/tankShape), so the preview is pixel-identical to the tank you
 * actually pilot. Used in the Home centerpiece, Tank-Select, Profile, Rankings
 * podium and the topbar chip.
 */
export function TankAvatar({
  bodyColor,
  turretColor,
  size = 120,
  angle = -Math.PI / 2,
  className,
  title,
}: TankAvatarProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const turret = turretColor ?? bodyColor;
  const hidden = isHiddenTank(bodyColor);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || hidden) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    // Hull sits a touch below centre (like the old preview) so the up-pointing
    // barrel has room; r is sized so barrel tip + outline stay inside the box.
    const r = size * 0.29;
    drawTank(ctx, {
      cx: size / 2,
      cy: size * 0.55,
      r,
      bodyColor,
      turretColor: turret,
      angle,
    });
  }, [bodyColor, turret, size, angle, hidden]);

  if (hidden) return null;

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={className}
      role="img"
      aria-label={title ?? "tank"}
    />
  );
}
