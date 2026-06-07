import { forwardRef, useEffect } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "../../../lib/cn";
import { springs } from "../../../lib/motion";
import { ui } from "../../../audio";

// Radix Dialog gives us focus trap, Esc-to-close, scroll lock and focus
// restoration for free — the native <dialog> + DaisyUI setup had none of it.
// Motion adds the spring entrance (a centred scale-pop + a backdrop fade).
//
// Integration note: we drive the animation with `asChild` + a real `motion.div`
// rather than `motion.create(RadixDialog.Content)`. Wrapping the Radix primitive
// directly left the panel stuck at its `initial` state (invisible, uncentred,
// since `style={{ x, y }}` only resolves when Motion controls the node) — only
// the overlay's static blur showed. asChild hands Motion an actual DOM node.
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
  ) => {
    // Radix only mounts the content while the dialog is open, so mount/unmount
    // map cleanly to a swoosh-in / swoosh-out.
    useEffect(() => {
      ui.open();
      return () => ui.close();
    }, []);

    return (
      <RadixDialog.Portal>
        <RadixDialog.Overlay asChild>
          <motion.div
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
          />
        </RadixDialog.Overlay>
        <RadixDialog.Content ref={ref} asChild {...props}>
          <motion.div
            className={cn(
              "fixed left-1/2 top-1/2 z-[101]",
              "max-h-[90vh] overflow-y-auto border-4 border-ink rounded-arcade shadow-arcade",
              "p-6 focus:outline-none",
              tone === "dark"
                ? "bg-panel-dark/95 text-white backdrop-blur-md"
                : "bg-white text-ink",
              widthClassName,
              className
            )}
            // Centre via Motion's x/y so the scale-pop composes with the offset
            // (the Tailwind -translate-1/2 classes would be clobbered by Motion's
            // inline transform).
            style={{ x: "-50%", y: "-50%" }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={springs.soft}
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
          </motion.div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    );
  }
);
DialogContent.displayName = "DialogContent";
