import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

const controlClass =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subtle transition-colors hover:border-accent/60 focus:border-accent focus:outline-none disabled:opacity-50";

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
        className="flex items-baseline justify-between text-[13px] font-medium text-text"
      >
        <span>{label}</span>
        {optional && (
          <span className="text-[11px] font-normal text-text-subtle">valfritt</span>
        )}
      </label>
      {children}
      {hint && <p className="text-[11px] text-text-subtle">{hint}</p>}
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
