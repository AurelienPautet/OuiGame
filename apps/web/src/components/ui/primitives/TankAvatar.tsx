import { palette, tankColors, isHiddenTank } from "../../../theme/palette";

interface TankAvatarProps {
  /** Hull colour NAME (see constants/tankColors.ts). */
  bodyColor: string;
  /** Barrel colour NAME; defaults to the body colour. */
  turretColor?: string;
  /** Rendered px size (square). */
  size?: number;
  className?: string;
  /** Accessible label; falls back to "tank". */
  title?: string;
}

const INK = palette.ink;

/**
 * Top-down arcade tank as an SVG — circle hull + barrel + track plates + thick
 * ink outline. Shares the colour language of the canvas renderer (theme/palette)
 * so the menu tank and the in-game tank look identical. Used in the Home
 * centerpiece, Tank-Select preview, profile, rankings podium and the topbar chip.
 */
export function TankAvatar({
  bodyColor,
  turretColor,
  size = 120,
  className,
  title,
}: TankAvatarProps) {
  if (isHiddenTank(bodyColor)) return null;
  const body = tankColors(bodyColor);
  const turret = tankColors(turretColor ?? bodyColor);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label={title ?? "tank"}
    >
      {/* track plates */}
      <rect
        x="34"
        y="60"
        width="20"
        height="80"
        rx="6"
        fill="#9aa2ad"
        stroke={INK}
        strokeWidth="5"
      />
      <rect
        x="146"
        y="60"
        width="20"
        height="80"
        rx="6"
        fill="#9aa2ad"
        stroke={INK}
        strokeWidth="5"
      />
      {/* barrel */}
      <rect
        x="86"
        y="20"
        width="28"
        height="78"
        rx="4"
        fill={turret.fill}
        stroke={INK}
        strokeWidth="5"
      />
      {/* hull */}
      <circle
        cx="100"
        cy="110"
        r="46"
        fill={body.fill}
        stroke={INK}
        strokeWidth="6"
      />
      <circle
        cx="100"
        cy="110"
        r="14"
        fill="rgba(0,0,0,0.18)"
        stroke={INK}
        strokeWidth="3"
      />
    </svg>
  );
}
