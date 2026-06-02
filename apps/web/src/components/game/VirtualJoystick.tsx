import { useRef, useState, useCallback } from "react";

// Max thumb travel from the base centre, in CSS px. The emitted vector is the
// thumb offset divided by this, so it is clamped to magnitude ≤ 1.
const MAX_RADIUS = 56;

export interface JoystickVector {
  x: number;
  y: number;
}

interface VirtualJoystickProps {
  /** Called with the normalized thumb offset (|v| ≤ 1) on move, null on release. */
  onChange: (vec: JoystickVector | null) => void;
  /** Which screen edge this stick lives against (drives its zone + colour hint). */
  side: "left" | "right";
  /** Accent colour for the thumb (e.g. the player's turret colour). */
  tint?: string;
  ariaLabel?: string;
}

/**
 * A floating/dynamic virtual joystick. The base materialises wherever the thumb
 * first lands inside its zone, so the player never has to find a fixed stick.
 *
 * Built on Pointer Events with per-`pointerId` capture, so multiple sticks +
 * buttons work as independent simultaneous touches. The zone sets
 * `touch-action: none` and the handlers `preventDefault()` so dragging never
 * scrolls/zooms the page or triggers the long-press context menu.
 *
 * It reports a *relative* normalized vector (scale-invariant) rather than an
 * absolute point, so it works unchanged on the CSS-scaled game stage.
 */
export const VirtualJoystick = ({
  onChange,
  side,
  tint = "#ffffff",
  ariaLabel,
}: VirtualJoystickProps) => {
  // The claimed pointer + where it first touched down (relative to the zone box).
  const pointerIdRef = useRef<number | null>(null);
  const originRef = useRef<JoystickVector>({ x: 0, y: 0 });
  // null while idle; the base origin + current thumb offset while engaged.
  const [base, setBase] = useState<JoystickVector | null>(null);
  const [offset, setOffset] = useState<JoystickVector>({ x: 0, y: 0 });

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== null) return; // already tracking a finger
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointerIdRef.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    originRef.current = { x, y };
    setBase({ x, y });
    setOffset({ x: 0, y: 0 });
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerId !== pointerIdRef.current) return;
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      let dx = e.clientX - rect.left - originRef.current.x;
      let dy = e.clientY - rect.top - originRef.current.y;
      const dist = Math.hypot(dx, dy);
      if (dist > MAX_RADIUS) {
        dx = (dx / dist) * MAX_RADIUS;
        dy = (dy / dist) * MAX_RADIUS;
      }
      setOffset({ x: dx, y: dy });
      onChange({ x: dx / MAX_RADIUS, y: dy / MAX_RADIUS });
    },
    [onChange]
  );

  const release = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerId !== pointerIdRef.current) return;
      pointerIdRef.current = null;
      setBase(null);
      setOffset({ x: 0, y: 0 });
      onChange(null);
    },
    [onChange]
  );

  return (
    <div
      role="application"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      onPointerCancel={release}
      className={`pointer-events-auto absolute bottom-0 h-[68%] w-[46%] ${
        side === "left" ? "left-0" : "right-0"
      }`}
      style={{ touchAction: "none" }}
    >
      {base && (
        <>
          {/* Base ring (where the thumb landed) */}
          <div
            className="absolute rounded-full border-[3px] border-ink/70 bg-white/15"
            style={{
              width: MAX_RADIUS * 2,
              height: MAX_RADIUS * 2,
              left: base.x,
              top: base.y,
              transform: "translate(-50%, -50%)",
            }}
          />
          {/* Thumb */}
          <div
            className="absolute rounded-full border-[3px] border-ink"
            style={{
              width: 56,
              height: 56,
              left: base.x + offset.x,
              top: base.y + offset.y,
              transform: "translate(-50%, -50%)",
              backgroundColor: tint,
            }}
          />
        </>
      )}
    </div>
  );
};
