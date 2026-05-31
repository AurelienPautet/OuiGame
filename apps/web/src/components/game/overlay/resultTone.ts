/**
 * Result tone — the single source of truth for win/lose/draw/neutral colour
 * across every game overlay. Only arcade tokens, never raw Tailwind palette.
 */
export type ResultTone = "win" | "lose" | "draw" | "neutral";

export interface ResultToneStyle {
  /** Text token, e.g. `text-green`. */
  text: string;
  /** Accent-bar / fill token, e.g. `bg-green`. */
  bar: string;
}

export const RESULT_TONE: Record<ResultTone, ResultToneStyle> = {
  win: { text: "text-green", bar: "bg-green" },
  lose: { text: "text-red", bar: "bg-red" },
  draw: { text: "text-yellow", bar: "bg-yellow" },
  neutral: { text: "text-blue", bar: "bg-blue" },
};
