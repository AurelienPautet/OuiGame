import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "../../../lib/cn";
import { liftable } from "../../../lib/motion";
import { ui } from "../../../audio";

export interface CardProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  /** Locked / full: inert — no click, no hover-lift, no sound. */
  disabled?: boolean;
}

/**
 * Pressable arcade surface shared by the room / level / campaign list cards:
 * white panel, thick ink border, hard drop shadow, the hover-lift + press
 * juice, and the click/hover UI sounds — so every list card feels and sounds
 * the same and new ones get it for free. Per-card layout (flex direction,
 * padding, gap, the selected ring, `group`) comes in via `className`; content
 * via `children`.
 *
 * When `disabled` the card is inert: onClick is dropped, the lift/press removed
 * and no sound plays (callers still render their own dimmed/blurred overlay).
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { className, disabled = false, onClick, onHoverStart, children, ...props },
    ref
  ) => (
    <motion.div
      ref={ref}
      className={cn(
        "relative rounded-xl bg-white border-[3px] border-ink cursor-pointer",
        "shadow-[0_4px_0_rgba(0,0,0,0.12)] transition-[border-color,box-shadow] duration-150",
        className
      )}
      {...(disabled ? {} : liftable)}
      {...props}
      // Composed after the spread so a caller's onClick still runs (see Button).
      // Disabled cards keep inert handlers (no sound, no caller callback) rather
      // than `undefined`, which exactOptionalPropertyTypes forbids on these props.
      onClick={(e) => {
        if (disabled) return;
        ui.click();
        onClick?.(e);
      }}
      onHoverStart={(e, info) => {
        if (disabled) return;
        ui.hover();
        onHoverStart?.(e, info);
      }}
    >
      {children}
    </motion.div>
  )
);
Card.displayName = "Card";
