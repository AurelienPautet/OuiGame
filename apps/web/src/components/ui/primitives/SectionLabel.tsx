import { cn } from "../../../lib/cn";

/** Small uppercase dark pill label ("WELCOME BACK, COMMANDER"). */
export function SectionLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-block font-display font-bold text-[13px] tracking-[2px] uppercase text-white bg-ink px-3 py-[5px] rounded-[9px]",
        className
      )}
      {...props}
    />
  );
}
