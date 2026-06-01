import type { Transition, Variants } from "motion/react";

/**
 * Shared Motion presets for the arcade UI. The design language is chunky and
 * physical (thick ink borders, hard drop shadows, "press-into-the-shadow"
 * buttons), so everything here leans on springs rather than eased tweens.
 *
 * Reduced motion is honoured globally by `<MotionConfig reducedMotion="user">`
 * in App.tsx (transforms collapse, opacity stays); the helper components in
 * `motionComponents.tsx` additionally short-circuit their infinite/derived
 * animations for those users.
 *
 * Components live in `motionComponents.tsx` — kept separate so this constants
 * module stays Fast-Refresh-friendly (a file may not export both).
 */

// Spring presets, tuned for the toy-like arcade feel.
export const springs = {
  /** Quick, lightly-damped UI motion (panels, list items). */
  soft: { type: "spring", stiffness: 280, damping: 26 },
  /** Crisp, near-critically-damped (hover lifts, segmented controls). */
  snappy: { type: "spring", stiffness: 500, damping: 32 },
  /** Overshoots — celebratory pops (win screen icon, stars). */
  bouncy: { type: "spring", stiffness: 440, damping: 13, mass: 0.8 },
  /** Heavy + fast — the tactile button press. */
  press: { type: "spring", stiffness: 700, damping: 24, mass: 0.6 },
} satisfies Record<string, Transition>;

/** Hover-lift + press-down juice for buttons and pressable chips. */
export const pressable = {
  whileHover: { y: -2, scale: 1.03 },
  whileTap: { y: 2, scale: 0.96 },
  transition: springs.press,
} as const;

/** Gentler lift for big content cards (level/room rows). */
export const liftable = {
  whileHover: { y: -4 },
  whileTap: { scale: 0.985, y: -1 },
  transition: springs.snappy,
} as const;

/** Scale-and-fade pop, for dialogs / overlay panels. */
export const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: springs.soft },
  exit: { opacity: 0, scale: 0.95, y: 6, transition: { duration: 0.12 } },
};

/** Container that cascades its children in (use with `fadeUpItem`). */
export const staggerParent: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.03 } },
};

/** Child of `staggerParent` — rises + fades into place. */
export const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: springs.soft },
};
