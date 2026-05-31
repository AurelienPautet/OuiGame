import type { ReactNode } from "react";
import { cn } from "../../../lib/cn";
import { IoTitle } from "../../ui/primitives";
import { RESULT_TONE, type ResultTone } from "./resultTone";

interface OverlayPanelProps {
  /** Drives the top accent bar colour. Omit for a plain (no-bar) panel. */
  tone?: ResultTone;
  /** Big status icon shown above the title (already tone-coloured). */
  icon?: ReactNode;
  /** Outlined arcade heading. */
  title?: ReactNode;
  /** Muted line under the title. */
  subtitle?: ReactNode;
  children?: ReactNode;
  /** Pinned action row / progress cue at the bottom. */
  footer?: ReactNode;
  /** Override the default width (solo/MP screens are content-heavy). */
  widthClassName?: string;
  className?: string;
}

/**
 * The one standard overlay surface (rule 2): the dark arcade card every game
 * moment renders inside. A thin result-coloured accent bar carries the
 * win/lose signal so the title itself can stay the legible outlined white.
 */
export function OverlayPanel({
  tone,
  icon,
  title,
  subtitle,
  children,
  footer,
  widthClassName = "w-96 max-w-[90%]",
  className,
}: OverlayPanelProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden flex flex-col items-center gap-4 p-8 text-white",
        "bg-panel-dark/[0.92] border-4 border-ink rounded-arcade shadow-arcade backdrop-blur-sm",
        "animate-[arcadePopCentered_0.25s_ease-out]",
        widthClassName,
        className
      )}
    >
      {tone && (
        <span
          className={cn(
            "absolute inset-x-0 top-0 h-1.5",
            RESULT_TONE[tone].bar
          )}
        />
      )}
      {icon}
      {title && <IoTitle className="text-3xl text-center">{title}</IoTitle>}
      {subtitle && (
        <p className="text-white/60 text-center -mt-2">{subtitle}</p>
      )}
      {children}
      {footer}
    </div>
  );
}
