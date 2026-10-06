"use client";

import { cn } from "@/lib/cn";

/**
 * En av/på-växel med etikett. Påslagen är den lyft som ett valt läge
 * (DESIGN.md) – inte orange – med en tydlig knopp åt höger.
 */
export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group flex items-start gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        aria-hidden
        className={cn(
          "relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors duration-150",
          checked
            ? "border-text-subtle bg-text-muted"
            : "border-line-control bg-surface-2",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-3.5 rounded-full transition-[left,background-color] duration-150 ease-out motion-reduce:transition-none",
            checked ? "left-[18px] bg-canvas" : "left-0.5 bg-text-subtle",
          )}
        />
      </span>
      <span>
        <span className="block text-sm text-text">{label}</span>
        {hint && (
          <span className="block text-[12px] text-text-subtle">{hint}</span>
        )}
      </span>
    </button>
  );
}
