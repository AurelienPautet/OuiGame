import { forwardRef } from "react";
import * as RadixSwitch from "@radix-ui/react-switch";
import { cn } from "../../../lib/cn";
import { ui } from "../../../audio";

/** Chunky outlined toggle switch. */
export const Switch = forwardRef<
  React.ComponentRef<typeof RadixSwitch.Root>,
  React.ComponentPropsWithoutRef<typeof RadixSwitch.Root>
>(({ className, onCheckedChange, ...props }, ref) => (
  <RadixSwitch.Root
    ref={ref}
    className={cn(
      "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-[3px] border-ink bg-ink-soft/40 transition-colors data-[state=checked]:bg-green focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue/30 disabled:opacity-50",
      className
    )}
    {...props}
    // A rising/falling chirp matching the new state (composed with any caller).
    onCheckedChange={(checked) => {
      ui.toggle(checked);
      onCheckedChange?.(checked);
    }}
  >
    <RadixSwitch.Thumb className="block size-4 rounded-full border-2 border-ink bg-white transition-transform translate-x-1 data-[state=checked]:translate-x-[22px]" />
  </RadixSwitch.Root>
));
Switch.displayName = "Switch";
