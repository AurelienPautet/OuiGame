import { cn } from "../../../lib/cn";
import { ui } from "../../../audio";

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentOption<T>[];
  /** Active-segment colour. */
  tone?: "blue" | "yellow" | "green";
  className?: string;
  "aria-label"?: string;
}

const TONE: Record<string, string> = {
  blue: "bg-blue text-white",
  yellow: "bg-yellow text-ink",
  green: "bg-green text-white",
};

/**
 * Dark segmented toggle (Online/Solo, Kills/Wins/Win-rate, editor mode). Pure
 * state control — not tab panels — so it stays a simple button group.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  tone = "blue",
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex bg-panel-dark/[0.86] border-4 border-ink rounded-[13px] overflow-hidden shadow-arcade",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              ui.tab();
              onValueChange(opt.value);
            }}
            onMouseEnter={() => ui.hover()}
            className={cn(
              "font-display font-bold text-sm px-5 py-2.5 cursor-pointer transition-colors",
              active ? TONE[tone] : "text-white/70 hover:text-white"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
