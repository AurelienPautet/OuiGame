import { cn } from "../../../lib/cn";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

/** White, thick-outlined arcade card. */
export function Panel({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "bg-white border-4 border-ink rounded-arcade shadow-arcade",
        className
      )}
      {...props}
    />
  );
}

/** Translucent dark panel — the io leaderboard / minimap / HUD motif. */
export function DarkPanel({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "bg-panel-dark/[0.86] text-white border-4 border-ink rounded-arcade shadow-arcade backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
}
