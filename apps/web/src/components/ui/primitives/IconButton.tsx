import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "../../../lib/cn";
import { pressable } from "../../../lib/motion";

export interface IconButtonProps extends Omit<
  HTMLMotionProps<"button">,
  "ref"
> {
  /** Visual size of the square button. */
  size?: "sm" | "md";
}

// Square, white, outlined icon button (undo/redo/clear/close in toolbars).
// Motion owns the hover-lift + press; CSS keeps only the colour transition.
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = "md", type = "button", ...props }, ref) => (
    <motion.button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center cursor-pointer border-[3px] border-ink rounded-[11px] bg-white text-ink shadow-[0_3px_0_rgba(0,0,0,0.18)] transition-colors hover:bg-[#f1f3f6] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/25",
        size === "sm" ? "size-9" : "size-[42px]",
        className
      )}
      {...pressable}
      {...props}
    />
  )
);
IconButton.displayName = "IconButton";
