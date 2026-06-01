import { forwardRef } from "react";
import { cn } from "../../../lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full font-display font-semibold text-ink bg-white border-[3px] border-ink rounded-[11px] px-3.5 py-2.5 placeholder:text-ink-soft/70 outline-none transition-shadow focus:ring-4 focus:ring-blue/30 disabled:opacity-60",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full font-display font-medium text-ink bg-white border-[3px] border-ink rounded-[11px] px-3.5 py-2.5 placeholder:text-ink-soft/70 outline-none transition-shadow focus:ring-4 focus:ring-blue/30 disabled:opacity-60 resize-none",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
