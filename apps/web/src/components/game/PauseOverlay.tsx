import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Play, LogOut, Pause, Settings, RotateCcw } from "lucide-react";
import { Button } from "../ui/primitives";
import { OverlayScrim, OverlayPanel } from "./overlay";

interface PauseOverlayProps {
  onResume: () => void;
  onQuit: () => void;
  onSettings: () => void;
  // Solo/campaign only; GameCanvas passes `undefined` for online, so this must
  // explicitly admit undefined under exactOptionalPropertyTypes.
  onRetry?: (() => void) | undefined;
}

/**
 * Pause overlay — same white arcade card as the end screens, so pausing reads
 * as part of the same overlay system rather than a one-off.
 */
export const PauseOverlay = ({
  onResume,
  onQuit,
  onSettings,
  onRetry,
}: PauseOverlayProps) => {
  const { t } = useTranslation();
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.key === "r" || e.key === "R") && onRetry) onRetry();
      if (e.key === "q" || e.key === "Q") onQuit();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onRetry, onQuit]);

  return (
    <OverlayScrim>
      <OverlayPanel
        icon={<Pause className="w-14 h-14 text-ink" />}
        title={t("pause.title")}
      >
        <div className="flex flex-col gap-3 w-full">
          <Button variant="green" className="w-full" onClick={onResume}>
            <Play className="w-4 h-4" />
            {t("pause.resume")}
          </Button>
          {onRetry && (
            <Button variant="blue" className="w-full" onClick={onRetry}>
              <RotateCcw className="w-4 h-4" />
              {t("pause.retry")}
              <kbd className="ml-1 px-1.5 py-0.5 text-xs font-mono font-normal bg-white/20 border border-white/30 rounded">
                R
              </kbd>
            </Button>
          )}
          <div className="flex gap-3 w-full">
            <Button variant="ghost" className="flex-1" onClick={onSettings}>
              <Settings className="w-4 h-4" />
              {t("pause.settings")}
            </Button>
            <Button variant="ghost" className="flex-1" onClick={onQuit}>
              <LogOut className="w-4 h-4" />
              {t("pause.quit")}
              <kbd className="ml-1 px-1.5 py-0.5 text-xs font-mono font-normal bg-black/10 border border-black/15 rounded">
                Q
              </kbd>
            </Button>
          </div>
        </div>
      </OverlayPanel>
    </OverlayScrim>
  );
};
