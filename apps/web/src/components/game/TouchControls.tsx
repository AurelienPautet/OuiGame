import { useCallback, useEffect } from "react";
import { Bomb, Crosshair, Pause } from "lucide-react";
import { VirtualJoystick, type JoystickVector } from "./VirtualJoystick";

// Deadzones (as a fraction of full stick travel). The move stick maps to 8-way
// signs like the keyboard; the aim stick needs a slightly larger neutral so the
// turret angle doesn't jitter near centre.
const MOVE_DEADZONE = 0.3;
const AIM_DEADZONE = 0.25;

interface TouchControlsProps {
  /** Hold the aim stick to fire continuously; when false, show a fire button. */
  autoFire: boolean;
  /** Open/close the pause menu (shares the engine's pause path). */
  onPause: () => void;
  /** Accent colour (player's turret colour) for the sticks/buttons. */
  color: string;
}

/**
 * On-screen twin-stick controls for touch play. It writes intent straight into
 * the global `window.gameInput` the engine already reads — left stick drives
 * `direction`, right stick drives `aimVector` (+ held `firing` when auto-fire is
 * on), and the buttons set `plant` / `click` / pause. The simulation is
 * untouched; the engine resolves `aimVector` into the absolute `aim` it expects.
 */
export const TouchControls = ({
  autoFire,
  onPause,
  color,
}: TouchControlsProps) => {
  // Left stick → 8-way movement sign (matches keyboard semantics).
  const onMove = useCallback((vec: JoystickVector | null) => {
    const input = window.gameInput;
    if (!input) return;
    if (!vec) {
      input.direction = { x: 0, y: 0 };
      return;
    }
    input.direction = {
      x: Math.abs(vec.x) > MOVE_DEADZONE ? Math.sign(vec.x) : 0,
      y: Math.abs(vec.y) > MOVE_DEADZONE ? Math.sign(vec.y) : 0,
    };
  }, []);

  // Right stick → aim direction (+ auto-fire while actively aimed).
  const onAim = useCallback(
    (vec: JoystickVector | null) => {
      const input = window.gameInput;
      if (!input) return;
      // Released, or inside the neutral zone: stop firing but keep the last
      // facing so the turret holds its aim.
      if (!vec) {
        input.firing = false;
        return;
      }
      const dist = Math.hypot(vec.x, vec.y);
      if (dist < AIM_DEADZONE) {
        input.firing = false;
        return;
      }
      input.aimVector = { x: vec.x / dist, y: vec.y / dist };
      input.firing = autoFire;
    },
    [autoFire]
  );

  // Reset any held state when the controls unmount (overlay up / quit) so the
  // tank doesn't keep moving/firing on the stale global.
  useEffect(() => {
    return () => {
      const input = window.gameInput;
      if (!input) return;
      input.direction = { x: 0, y: 0 };
      input.firing = false;
      input.aimVector = null;
    };
  }, []);

  const plant = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (window.gameInput) window.gameInput.plant = true;
  }, []);

  const fire = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (window.gameInput) window.gameInput.click = true;
  }, []);

  const btn =
    "pointer-events-auto absolute flex items-center justify-center rounded-full border-4 border-ink text-white shadow-btn active:translate-y-1 active:shadow-none select-none";

  return (
    <div className="absolute inset-0 z-30" style={{ touchAction: "none" }}>
      <VirtualJoystick
        side="left"
        onChange={onMove}
        tint={color}
        ariaLabel="Move"
      />
      <VirtualJoystick
        side="right"
        onChange={onAim}
        tint={color}
        ariaLabel="Aim and fire"
      />

      {/* Pause */}
      <button
        type="button"
        onClick={onPause}
        className={`${btn} top-4 right-4 h-12 w-12 bg-ink/80`}
        aria-label="Pause"
      >
        <Pause className="h-5 w-5" strokeWidth={2.5} />
      </button>

      {/* Plant mine */}
      <button
        type="button"
        onPointerDown={plant}
        className={`${btn} bottom-44 right-8 h-16 w-16 bg-yellow text-ink`}
        aria-label="Plant mine"
      >
        <Bomb className="h-7 w-7" strokeWidth={2.5} />
      </button>

      {/* Fire (only when auto-fire is off) */}
      {!autoFire && (
        <button
          type="button"
          onPointerDown={fire}
          className={`${btn} bottom-20 right-8 h-20 w-20 bg-red`}
          aria-label="Fire"
        >
          <Crosshair className="h-9 w-9" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
};
