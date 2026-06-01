import { cn } from "../../../lib/cn";

interface StatPillProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Coloured status dot on the left. */
  dotColor?: string;
  num: React.ReactNode;
  label: React.ReactNode;
}

/** Dark live-stat pill ("1,284 players online"). */
export function StatPill({
  dotColor,
  num,
  label,
  className,
  ...props
}: StatPillProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 bg-panel-dark/[0.86] text-white border-[3px] border-ink rounded-xl px-4 py-2",
        className
      )}
      {...props}
    >
      {dotColor && (
        <span
          className="size-[11px] rounded-full border-2 border-ink"
          style={{ background: dotColor }}
        />
      )}
      <span className="text-xl font-bold leading-none">{num}</span>
      <span className="text-xs text-white/70 tracking-wide">{label}</span>
    </div>
  );
}
