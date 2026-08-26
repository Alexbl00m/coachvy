import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

const controlClass =
  "w-full rounded-md border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-400 transition-colors hover:border-ink-500 focus:border-accent focus:outline-none disabled:opacity-50";

type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
};

export function Field({
  label,
  htmlFor,
  hint,
  optional = false,
  children,
}: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="flex items-baseline justify-between text-[13px] font-medium text-ink-200"
      >
        <span>{label}</span>
        {optional && (
          <span className="text-[11px] font-normal text-ink-400">valfritt</span>
        )}
      </label>
      {children}
      {hint && <p className="text-[11px] text-ink-400">{hint}</p>}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClass, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(controlClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea className={cn(controlClass, "resize-y", className)} {...props} />
  );
}
