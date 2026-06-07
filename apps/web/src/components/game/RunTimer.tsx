import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Timer } from "lucide-react";

/**
 * RunTimer - solo-only overlay showing the elapsed time of the ongoing run.
 * A floating dark pill (the StatPill motif used by the menu Topbar / LivesHud),
 * so it reads clearly over the light play field.
 *
 * It polls the engine via `getElapsedMs` on every animation frame but only
 * re-renders when the displayed (whole-second) label actually changes, so React
 * updates roughly once a second rather than every frame. Whole seconds also
 * match the precision of the final submitted run time.
 */
interface RunTimerProps {
  /** Reads the engine's current run elapsed time in ms. Stable identity. */
  getElapsedMs: () => number;
}

const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const RunTimer = ({ getElapsedMs }: RunTimerProps) => {
  const { t } = useTranslation();
  const [label, setLabel] = useState(() => formatTime(getElapsedMs()));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const next = formatTime(getElapsedMs());
      // Returning the previous value bails React out of a re-render, so this
      // only repaints when the second ticks over rather than every frame.
      setLabel((prev) => (prev === next ? prev : next));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [getElapsedMs]);

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-panel-dark/[0.86] border-[3px] border-ink rounded-full px-5 py-2 text-white pointer-events-none"
      role="timer"
      aria-label={t("runTimer.aria")}
    >
      <Timer className="w-5 h-5 text-orange" aria-hidden="true" />
      <span className="font-bold text-sm tracking-wide tabular-nums">
        {label}
      </span>
    </div>
  );
};
