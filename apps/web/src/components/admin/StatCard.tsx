import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type StatTone =
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "purple"
  | "orange"
  | "teal";

export interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: StatTone;
  icon?: ReactNode;
}

// tone → the arcade fill utility for the icon chip (mirrors index.css tokens).
const TONE_BG: Record<StatTone, string> = {
  blue: "bg-blue",
  green: "bg-green",
  yellow: "bg-yellow",
  red: "bg-red",
  purple: "bg-purple",
  orange: "bg-orange",
  teal: "bg-teal",
};

/**
 * Arcade KPI tile — a white thick-outlined card with a big bold value, a small
 * uppercase label, an optional hint line and an optional tone-coloured icon
 * chip. The headline metric of the admin dashboard grid.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "blue",
  icon,
}: StatCardProps) {
  return (
    <div className="flex items-center gap-3.5 bg-white border-4 border-ink rounded-arcade shadow-arcade px-4 py-3.5">
      {icon && (
        <span
          className={cn(
            "flex items-center justify-center size-11 shrink-0 rounded-xl border-[3px] border-ink text-ink",
            TONE_BG[tone]
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <div className="text-3xl font-bold leading-none text-ink tabular-nums truncate">
          {value}
        </div>
        <div className="mt-1 text-[11px] font-bold uppercase tracking-[1.5px] text-ink-soft truncate">
          {label}
        </div>
        {hint && (
          <div className="mt-0.5 text-xs font-semibold text-ink-soft/80 truncate">
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}
