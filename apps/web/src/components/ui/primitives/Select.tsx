import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../../lib/cn";

export interface SelectOption {
  value: string;
  label: React.ReactNode;
}

interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

/** Outlined arcade Select (Radix) — styled trigger + popover list. */
export function Select({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: SelectProps) {
  return (
    <RadixSelect.Root
      {...(value !== undefined ? { value } : {})}
      {...(defaultValue !== undefined ? { defaultValue } : {})}
      {...(onValueChange ? { onValueChange } : {})}
    >
      <RadixSelect.Trigger
        aria-label={ariaLabel}
        className={cn(
          "inline-flex items-center justify-between gap-2 font-display font-semibold text-ink bg-white border-[3px] border-ink rounded-[11px] px-3.5 py-2.5 cursor-pointer outline-none focus:ring-4 focus:ring-blue/30 data-[placeholder]:text-ink-soft/70",
          className
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown size={18} strokeWidth={3} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          className="z-[200] min-w-[var(--radix-select-trigger-width)] bg-white border-4 border-ink rounded-[13px] shadow-arcade overflow-hidden"
        >
          <RadixSelect.Viewport className="p-1.5">
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value}
                value={opt.value}
                className="relative flex items-center gap-2 font-display font-semibold text-ink rounded-lg px-3 py-2 pr-8 cursor-pointer outline-none data-[highlighted]:bg-field data-[state=checked]:bg-blue/15"
              >
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="absolute right-2.5">
                  <Check size={16} strokeWidth={3} />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
