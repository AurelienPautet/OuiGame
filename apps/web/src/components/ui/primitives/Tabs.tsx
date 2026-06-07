import { forwardRef } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "../../../lib/cn";
import { ui } from "../../../audio";

// Radix Tabs — keyboard nav (arrows/Home/End) + ARIA roles for free, replacing
// the hand-rolled components/ui/Tabs.tsx (which had neither).
export const Tabs = RadixTabs.Root;

export const TabsList = forwardRef<
  React.ComponentRef<typeof RadixTabs.List>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.List>
>(({ className, ...props }, ref) => (
  <RadixTabs.List
    ref={ref}
    className={cn("flex w-full gap-2", className)}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = forwardRef<
  React.ComponentRef<typeof RadixTabs.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Trigger>
>(({ className, onClick, ...props }, ref) => (
  <RadixTabs.Trigger
    ref={ref}
    className={cn(
      "flex-1 py-3 px-4 text-center font-display font-semibold uppercase rounded-t-xl cursor-pointer transition-colors",
      "border-x-[3px] border-t-[3px] border-transparent text-ink-soft hover:text-ink",
      "data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:border-ink",
      "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue/30",
      className
    )}
    {...props}
    onClick={(e) => {
      ui.tab();
      onClick?.(e);
    }}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = forwardRef<
  React.ComponentRef<typeof RadixTabs.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Content>
>(({ className, ...props }, ref) => (
  <RadixTabs.Content
    ref={ref}
    className={cn("focus-visible:outline-none", className)}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";
