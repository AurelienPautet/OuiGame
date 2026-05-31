import type { ReactNode } from "react";
import { cn } from "../../../lib/cn";

interface OverlayScrimProps {
  children: ReactNode;
  className?: string;
}

/**
 * The one standard backdrop for every game overlay (rule 1): a dimmed, blurred
 * full-screen layer that centres its panel. All overlays share this scrim so
 * they fade in and sit identically.
 */
export function OverlayScrim({ children, className }: OverlayScrimProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm animate-[arcadeFadeIn_0.2s_ease-out]",
        className
      )}
    >
      {children}
    </div>
  );
}
