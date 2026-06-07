import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw, LogOut } from "lucide-react";
import { Button } from "../../ui/primitives";
import { cn } from "../../../lib/cn";

interface OverlayActionsProps {
  onReplay: () => void;
  onQuit: () => void;
  replayLabel?: string;
  quitLabel?: string;
  className?: string;
}

/**
 * The one standard overlay button row (rule 6): a green primary and a ghost
 * secondary, equal width. Used by every end screen and the pause overlay.
 */
export function OverlayActions({
  onReplay,
  onQuit,
  replayLabel,
  quitLabel,
  className,
}: OverlayActionsProps) {
  const { t } = useTranslation();
  const replay = replayLabel ?? t("endGame.playAgain");
  const quit = quitLabel ?? t("endGame.quit");
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") onReplay();
      if (e.key === "e" || e.key === "E") onQuit();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onReplay, onQuit]);

  return (
    <div className={cn("flex gap-3 w-full", className)}>
      <Button variant="green" className="flex-1" onClick={onReplay}>
        <RotateCcw className="w-4 h-4" />
        {replay}
        <kbd className="ml-1 px-1.5 py-0.5 text-xs font-mono font-normal bg-white/20 border border-white/30 rounded">
          R
        </kbd>
      </Button>
      <Button variant="ghost" className="flex-1" onClick={onQuit}>
        <LogOut className="w-4 h-4" />
        {quit}
        <kbd className="ml-1 px-1.5 py-0.5 text-xs font-mono font-normal bg-black/10 border border-black/15 rounded">
          E
        </kbd>
      </Button>
    </div>
  );
}
