import type { ReactNode } from "react";
import { motion, type Variants } from "motion/react";
import { cn } from "../../../lib/cn";
import { springs } from "../../../lib/motion";
import { RESULT_TONE, type ResultTone } from "./resultTone";

// The panel springs in (scale-pop) and orchestrates a cascade of its inner
// rows; each row rides `rowVariant`, the icon gets an extra bouncy entrance.
const panelVariant: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      ...springs.bouncy,
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
};
const rowVariant: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: springs.soft },
};
const iconVariant: Variants = {
  hidden: { opacity: 0, scale: 0.3, rotate: -12 },
  visible: { opacity: 1, scale: 1, rotate: 0, transition: springs.bouncy },
};

interface OverlayPanelProps {
  /** Drives the top accent bar colour. Omit for a plain (no-bar) panel. */
  tone?: ResultTone;
  /** Big status icon shown above the title. */
  icon?: ReactNode;
  /** Heading. */
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
 * The one standard overlay surface (rule 2): the white arcade card every game
 * moment renders inside — same motif as the menu `Panel` (white, 4px ink
 * border, arcade shadow). A thin result-coloured accent bar carries the
 * win/lose signal; the title stays solid ink so it reads on white.
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
    <motion.div
      className={cn(
        "relative overflow-hidden flex flex-col items-center gap-4 p-8 text-ink",
        "bg-white border-4 border-ink rounded-arcade shadow-arcade",
        widthClassName,
        className
      )}
      variants={panelVariant}
      initial="hidden"
      animate="visible"
    >
      {tone && (
        <span
          className={cn(
            "absolute inset-x-0 top-0 h-1.5",
            RESULT_TONE[tone].bar
          )}
        />
      )}
      {icon && <motion.div variants={iconVariant}>{icon}</motion.div>}
      {title && (
        <motion.h2
          variants={rowVariant}
          className="font-display font-bold text-3xl text-center text-ink"
        >
          {title}
        </motion.h2>
      )}
      {subtitle && (
        <motion.p
          variants={rowVariant}
          className="text-ink-soft text-center -mt-2"
        >
          {subtitle}
        </motion.p>
      )}
      {children}
      {footer}
    </motion.div>
  );
}
