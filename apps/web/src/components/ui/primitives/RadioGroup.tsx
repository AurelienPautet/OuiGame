import {
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "../../../lib/cn";
import { ui } from "../../../audio";

export interface RadioGroupProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly T[];
  /** Accessible name for the group (required — it has no visible label of its own). */
  "aria-label": string;
  /** Class on the radiogroup container. */
  className?: string;
  /** Accessible label announced per option. Defaults to the option value. */
  optionLabel?: (value: T) => string;
  /** Class for each radio button; receives whether that option is selected. */
  optionClassName?: (value: T, checked: boolean) => string;
  /** Inline style per radio (e.g. a colour-swatch background). */
  optionStyle?: (value: T) => CSSProperties;
  /** Inner visual of each radio (text, icon…). Omit for pure colour swatches. */
  children?: (value: T, checked: boolean) => ReactNode;
}

/**
 * Single-select group with arcade audio feedback. Mirrors the shared
 * Button/IconButton primitives by routing every pick through `ui.click()`, and
 * implements the WAI-ARIA radiogroup pattern so callers never re-hand-roll bare
 * <button> selectors (which is exactly how the tank colour swatches ended up
 * silent). Roving tabindex + arrow keys move and select; the visual of each
 * radio is the caller's via `optionClassName`/`optionStyle`/`children`.
 */
export function RadioGroup<T extends string>({
  value,
  onValueChange,
  options,
  "aria-label": ariaLabel,
  className,
  optionLabel,
  optionClassName,
  optionStyle,
  children,
}: RadioGroupProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // When nothing matches `value`, the first option is the group's tab stop
  // (per the ARIA pattern — a radiogroup is always reachable by Tab).
  const selectedIndex = options.indexOf(value);
  const focusIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const pick = (next: T) => {
    ui.click();
    onValueChange(next);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = options.length - 1;
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown")
      nextIndex = i === last ? 0 : i + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      nextIndex = i === 0 ? last : i - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    pick(options[nextIndex]!);
    refs.current[nextIndex]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={className}>
      {options.map((option, i) => {
        const checked = option === value;
        return (
          <button
            key={option}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-label={optionLabel ? optionLabel(option) : option}
            aria-checked={checked}
            tabIndex={i === focusIndex ? 0 : -1}
            onClick={() => pick(option)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/25",
              optionClassName?.(option, checked)
            )}
            {...(optionStyle ? { style: optionStyle(option) } : {})}
          >
            {children?.(option, checked)}
          </button>
        );
      })}
    </div>
  );
}
