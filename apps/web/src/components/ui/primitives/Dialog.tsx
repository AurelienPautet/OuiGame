import { forwardRef } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../../lib/cn";

// Radix Dialog gives us focus trap, Esc-to-close, scroll lock and focus
// restoration for free — the native <dialog> + DaisyUI setup had none of it.
export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;
export const DialogTitle = RadixDialog.Title;
export const DialogDescription = RadixDialog.Description;

export interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof RadixDialog.Content
> {
  /** Light = white arcade panel (default). Dark = translucent ink panel. */
  tone?: "light" | "dark";
  /** Render the built-in top-right close button. */
  showClose?: boolean;
  /** Constrain the panel width (Tailwind class). */
  widthClassName?: string;
}

export const DialogContent = forwardRef<
  React.ComponentRef<typeof RadixDialog.Content>,
  DialogContentProps
>(
  (
    {
      className,
      children,
      tone = "light",
      showClose = true,
      widthClassName = "w-[min(92vw,560px)]",
      ...props
    },
    ref
  ) => (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm data-[state=open]:animate-[arcadeFadeIn_0.15s_ease]" />
      <RadixDialog.Content
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 z-[101] -translate-x-1/2 -translate-y-1/2",
          "max-h-[90vh] overflow-y-auto border-4 border-ink rounded-arcade shadow-arcade",
          "p-6 focus:outline-none data-[state=open]:animate-[arcadePop_0.18s_ease]",
          tone === "dark"
            ? "bg-panel-dark/95 text-white backdrop-blur-md"
            : "bg-white text-ink",
          widthClassName,
          className
        )}
        {...props}
      >
        {children}
        {showClose && (
          <RadixDialog.Close
            aria-label="Close"
            className={cn(
              "absolute top-3.5 right-3.5 inline-flex items-center justify-center size-9 rounded-[10px] border-[3px] border-ink cursor-pointer transition-colors",
              tone === "dark"
                ? "bg-white/10 text-white hover:bg-white/20"
                : "bg-white text-ink hover:bg-[#f1f3f6]"
            )}
          >
            <X size={18} strokeWidth={3} />
          </RadixDialog.Close>
        )}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  )
);
DialogContent.displayName = "DialogContent";
