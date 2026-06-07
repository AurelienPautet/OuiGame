import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { playSfx } from "../../audio";

/**
 * CountdownOverlay - Displays a 3-2-1-GO countdown before game starts.
 * Arcade badge: ink-outlined dark disc with an outlined (io-title) number, so
 * it matches the rest of the overlay design system.
 *
 * The countdown is pausable: while `isPaused` is true the timer halts (and the
 * badge hides so the pause menu shows alone), then resumes the current step on
 * unpause. Each step is a fresh 1s timeout, so resuming restarts the current
 * number rather than tracking sub-second progress — fine for a 3-2-1 count.
 */
interface CountdownOverlayProps {
  isActive: boolean;
  isPaused?: boolean;
  onComplete?: () => void;
}

export const CountdownOverlay = ({
  isActive,
  isPaused = false,
  onComplete,
}: CountdownOverlayProps) => {
  const { t } = useTranslation();
  const [count, setCount] = useState(3);
  const [visible, setVisible] = useState(false);
  // Last count we beeped for, so pause/resume (which re-runs the effect without
  // changing the number) doesn't replay the current tick.
  const lastBeep = useRef<number | null>(null);

  // (Re)start the countdown whenever it becomes active.
  useEffect(() => {
    if (isActive) {
      setVisible(true);
      setCount(3);
    }
  }, [isActive]);

  // Drive the countdown one step at a time so it can pause/resume. While paused
  // (or inactive/hidden) no timer is scheduled, freezing the current number.
  useEffect(() => {
    if (!isActive || isPaused || !visible) return undefined;

    // At 0 we're showing "GO!" — hold briefly, then hide and complete.
    if (count <= 0) {
      const done = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 500);
      return () => clearTimeout(done);
    }

    const tick = setTimeout(() => {
      setCount((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(tick);
  }, [isActive, isPaused, visible, count, onComplete]);

  // Beep on each new number (3-2-1) and blast on "GO!" (count 0). Tracked by
  // ref so resuming from pause doesn't re-trigger the same step.
  useEffect(() => {
    if (!isActive || !visible || isPaused) return;
    if (lastBeep.current === count) return;
    lastBeep.current = count;
    playSfx(count > 0 ? "countdownBeep" : "countdownGo");
  }, [isActive, visible, isPaused, count]);

  // Hide the badge while paused so the pause menu shows on its own.
  if (!visible || isPaused) return null;

  const displayText = count === 0 ? t("countdown.go") : count.toString();

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="flex items-center justify-center size-28 rounded-full border-4 border-ink bg-panel-dark/[0.92] shadow-arcade backdrop-blur-sm animate-[countdownPop_0.3s_ease-out]">
        <span
          key={count}
          className="io-title font-display text-5xl animate-[countdownScale_0.3s_ease-out]"
        >
          {displayText}
        </span>
      </div>
    </div>
  );
};
