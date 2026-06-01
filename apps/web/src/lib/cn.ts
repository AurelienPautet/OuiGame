import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names: `clsx` resolves conditionals, `tailwind-merge`
 * dedupes conflicting utilities (so a later `bg-blue` wins over an earlier
 * `bg-red`). The standard helper paired with cva-based component variants.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
