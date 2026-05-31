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
  replayLabel = "Play Again",
  quitLabel = "Quit",
  className,
}: OverlayActionsProps) {
  return (
    <div className={cn("flex gap-3 w-full", className)}>
      <Button variant="green" className="flex-1" onClick={onReplay}>
        <RotateCcw className="w-4 h-4" />
        {replayLabel}
      </Button>
      <Button variant="ghost" className="flex-1" onClick={onQuit}>
        <LogOut className="w-4 h-4" />
        {quitLabel}
      </Button>
    </div>
  );
}
