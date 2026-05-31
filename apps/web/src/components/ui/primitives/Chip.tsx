import { forwardRef } from "react";
import { cn } from "../../../lib/cn";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  /** Featured/highlight styling (yellow when active). */
  featured?: boolean;
}

/** Rounded, outlined filter chip (Level Select toolbar). */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  (
    { className, active = false, featured = false, type = "button", ...props },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={active}
      className={cn(
        "font-display font-semibold text-sm cursor-pointer border-[3px] rounded-full px-[15px] py-[7px] transition-transform shadow-[0_3px_0_rgba(0,0,0,0.12)] hover:-translate-y-px",
        active
          ? featured
            ? "bg-yellow text-ink border-yellow-d"
            : "bg-ink text-white border-ink"
          : "bg-white text-ink border-ink",
        className
      )}
      {...props}
    />
  )
);
Chip.displayName = "Chip";
