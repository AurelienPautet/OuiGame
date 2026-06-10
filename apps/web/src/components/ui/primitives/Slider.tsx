import { forwardRef } from "react";
import * as RadixSlider from "@radix-ui/react-slider";
import { cn } from "../../../lib/cn";
import { ui } from "../../../audio";

/** Chunky outlined arcade slider (Radix) — keyboard + a11y for free. */
export const Slider = forwardRef<
  React.ComponentRef<typeof RadixSlider.Root>,
  React.ComponentPropsWithoutRef<typeof RadixSlider.Root>
>(({ className, onValueCommit, ...props }, ref) => (
  <RadixSlider.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
    // Click on commit (pointer release / keyboard step), not on every change —
    // a continuous drag would otherwise machine-gun the SFX. Composed after the
    // spread so a caller's own onValueCommit still runs.
    onValueCommit={(v) => {
      ui.click();
      onValueCommit?.(v);
    }}
  >
    <RadixSlider.Track className="relative h-2.5 w-full grow rounded-full border-2 border-ink bg-ink-soft/30">
      <RadixSlider.Range className="absolute h-full rounded-full bg-blue" />
    </RadixSlider.Track>
    <RadixSlider.Thumb
      className="block size-5 rounded-full border-[3px] border-ink bg-white shadow-[0_2px_0_rgba(0,0,0,0.18)] cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue/30"
      aria-label="Volume"
    />
  </RadixSlider.Root>
));
Slider.displayName = "Slider";
