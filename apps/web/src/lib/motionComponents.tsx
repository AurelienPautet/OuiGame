import { useEffect, type ReactNode } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { fadeUpItem, staggerParent } from "./motion";

/**
 * Reusable Motion helper components for the arcade UI. Presets/variants live in
 * `motion.ts`; keeping the components here means each file exports only one
 * "kind" of thing, which keeps Vite Fast Refresh working.
 */

/**
 * Cascade wrapper: renders a container whose `<MotionItem>` children animate in
 * one after another on mount.
 */
export function Stagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={staggerParent}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

/**
 * A single rise-and-fade item; pair with `<Stagger>`. It carries the
 * `fadeUpItem` variants by default and, having no `initial`/`animate` of its
 * own, inherits the "visible" label the parent broadcasts on mount.
 */
export function MotionItem({
  className,
  children,
  ...rest
}: React.ComponentProps<typeof motion.div>) {
  return (
    <motion.div variants={fadeUpItem} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

/** Idle bob — a slow vertical float (the home-page tank breathing). */
export function FloatY({
  children,
  className,
  distance = 8,
  duration = 3.2,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -distance, 0] }}
      transition={{ duration, ease: "easeInOut", repeat: Infinity }}
    >
      {children}
    </motion.div>
  );
}

/** Counts a number up from 0 on mount/value-change (juicy stat reveals). */
export function CountUp({
  value,
  duration = 0.9,
  className,
  format,
}: {
  value: number;
  duration?: number;
  className?: string;
  format?: (v: number) => string;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) =>
    format ? format(v) : Math.round(v).toLocaleString()
  );

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, {
      duration,
      // easeOutExpo — fast start, soft landing.
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [value, duration, reduce, mv]);

  return <motion.span className={className}>{text}</motion.span>;
}
