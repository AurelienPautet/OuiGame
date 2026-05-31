import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../../lib/cn";

// Chunky, flat, thick-outlined arcade button: 4px ink border, a hard drop shadow
// that the button "presses into" on :active (translate down + shadow collapses).
const button = cva(
  "inline-flex items-center justify-center gap-2 font-display font-bold cursor-pointer select-none whitespace-nowrap border-4 border-ink text-white transition-[transform,box-shadow,background-color] duration-100 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/25",
  {
    variants: {
      variant: {
        blue: "bg-blue hover:bg-[#13c0ee] shadow-btn",
        green: "bg-green hover:bg-[#15ef7c] shadow-btn",
        yellow: "bg-yellow text-ink hover:bg-[#fff07f] shadow-btn",
        red: "bg-red hover:bg-[#ff646a] shadow-btn",
        purple: "bg-purple hover:bg-[#cb96f7] shadow-btn",
        ghost:
          "bg-white text-ink hover:bg-[#f1f3f6] shadow-[0_5px_0_rgba(0,0,0,0.12)]",
      },
      size: {
        sm: "text-sm px-3 py-2 rounded-[11px]",
        md: "text-base px-[18px] py-3 rounded-[14px]",
        lg: "text-lg px-5 py-4 rounded-[14px]",
      },
    },
    defaultVariants: { variant: "blue", size: "md" },
  }
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(button({ variant, size }), className)}
      {...props}
    />
  )
);
Button.displayName = "Button";
