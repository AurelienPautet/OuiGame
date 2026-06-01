import { useState } from "react";
import { Star } from "lucide-react";
import { motion } from "motion/react";
import { springs } from "../../../lib/motion";
import { cn } from "../../../lib/cn";

interface StarRatingProps {
  /** Number of filled stars (0..max). */
  value: number;
  max?: number;
  /** Pixel size of each star. */
  size?: number;
  /**
   * When provided the control is interactive: hover previews the rating and a
   * click commits it (1-based count). Omit for a read-only display.
   */
  onRate?: (stars: number) => void;
  /**
   * Dim + show a not-allowed cursor and disable the hover preview. Clicks still
   * fire `onRate` (so a logged-out user can be told why it didn't take).
   */
  disabled?: boolean;
  className?: string;
}

/**
 * Shared 5-star rating. Empty stars render as a visible ink outline (not a
 * near-invisible faint fill), so the control reads on the white arcade cards as
 * well as on level thumbnails.
 */
export function StarRating({
  value,
  max = 5,
  size = 20,
  onRate,
  disabled = false,
  className,
}: StarRatingProps) {
  const [hovered, setHovered] = useState(-1);
  const interactive = !!onRate;
  const shown = hovered >= 0 ? hovered + 1 : value;

  return (
    <div
      className={cn("flex gap-1", className)}
      onMouseLeave={() => setHovered(-1)}
    >
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < shown;
        const live = interactive && !disabled;
        return (
          <motion.span
            key={i}
            className={cn(
              "inline-flex shrink-0",
              live && "cursor-pointer",
              interactive && disabled && "cursor-not-allowed opacity-70"
            )}
            // Interactive ratings bounce in (staggered) and react to hover/tap;
            // read-only displays render statically so long lists stay calm.
            {...(interactive
              ? {
                  initial: { scale: 0, rotate: -30 },
                  animate: { scale: 1, rotate: 0 },
                  transition: { ...springs.bouncy, delay: i * 0.05 },
                }
              : {})}
            {...(live
              ? {
                  whileHover: { scale: 1.25, y: -2 },
                  whileTap: { scale: 0.85 },
                }
              : {})}
            onMouseEnter={live ? () => setHovered(i) : undefined}
            onClick={interactive ? () => onRate?.(i + 1) : undefined}
          >
            <Star
              style={{ width: size, height: size }}
              strokeWidth={2.5}
              className={cn(
                "shrink-0 transition-colors duration-150",
                filled ? "fill-yellow text-yellow-d" : "fill-none text-ink/40"
              )}
            />
          </motion.span>
        );
      })}
    </div>
  );
}
