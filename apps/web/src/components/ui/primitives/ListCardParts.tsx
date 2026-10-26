import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../../lib/cn";

/** Shared map preview frame for level and campaign catalogue cards. */
export function ListCardPreview({
  src,
  alt,
  fallback,
  className,
}: {
  src?: string;
  alt: string;
  fallback?: ReactNode;
  className?: string;
}) {
  const frame = cn(
    "w-32 h-24 shrink-0 object-cover rounded-lg border-[3px] border-ink transition-transform duration-300 ease-out group-hover:scale-[1.04]",
    className
  );
  return src ? (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      width={128}
      height={96}
      className={frame}
    />
  ) : (
    <div
      aria-hidden="true"
      className={cn(frame, "graph-paper flex items-center justify-center")}
    >
      {fallback}
    </div>
  );
}

/** The compact stat badge used under level and campaign metadata. */
export function ListCardStat({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "danger" | "warning" | "info";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border-2 border-ink/15 rounded-md px-1.5 py-0.5 text-xs font-semibold",
        {
          neutral: "bg-field text-ink-soft",
          success: "bg-green/15 text-green-d",
          danger: "bg-red/15 text-red-d",
          warning: "bg-orange/15 text-orange-d",
          info: "bg-blue/15 text-blue-d",
        }[tone],
        className
      )}
      {...props}
    />
  );
}
