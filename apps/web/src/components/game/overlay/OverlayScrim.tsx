import type { ReactNode } from "react";
import { motion } from "motion/react";
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
    <motion.div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm",
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
