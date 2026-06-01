import type { ReactNode } from "react";
import { cn } from "../../../lib/cn";

interface StatProps {
  icon?: ReactNode;
  label: ReactNode;
  value: ReactNode;
  /**
   * `row` — full-width label↔value (campaign-end summary lists).
   * `cell` — compact icon + stacked label/value (stat grids).
   */
  layout?: "row" | "cell";
  className?: string;
}

/**
 * The one standard stat chip (rule 5) — a light tile on the white card. Numbers
 * use `tabular-nums` so times and counts line up without a monospace font.
 */
export function Stat({
  icon,
  label,
  value,
  layout = "row",
  className,
}: StatProps) {
  if (layout === "cell") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 bg-ink/[0.04] border-2 border-ink rounded-lg px-3 py-2",
          className
        )}
      >
        {icon}
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-[11px] uppercase tracking-wide text-ink-soft">
            {label}
          </span>
          <span className="text-base font-bold tabular-nums text-ink">
            {value}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 bg-ink/[0.04] border-2 border-ink rounded-lg px-4 py-2",
        className
      )}
    >
      <span className="flex items-center gap-2 text-sm text-ink-soft">
        {icon}
        {label}
      </span>
      <span className="font-bold tabular-nums text-ink">{value}</span>
    </div>
  );
}

interface StatGridProps {
  /** Column count for the grid (defaults to 2). */
  cols?: 2 | 3;
  children: ReactNode;
  className?: string;
}

/** Grid wrapper for `Stat` cells. */
export function StatGrid({ cols = 2, children, className }: StatGridProps) {
  return (
    <div
      className={cn(
        "w-full grid gap-2",
        cols === 3 ? "grid-cols-3" : "grid-cols-2",
        className
      )}
    >
      {children}
    </div>
  );
}
