import { forwardRef } from "react";
import { cn } from "../../../lib/cn";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual size of the square button. */
  size?: "sm" | "md";
}

// Square, white, outlined icon button (undo/redo/clear/close in toolbars).
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center cursor-pointer border-[3px] border-ink rounded-[11px] bg-white text-ink shadow-[0_3px_0_rgba(0,0,0,0.18)] transition-[transform,background-color] hover:bg-[#f1f3f6] active:translate-y-[3px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/25",
        size === "sm" ? "size-9" : "size-[42px]",
        className
      )}
      {...props}
    />
  )
);
IconButton.displayName = "IconButton";
