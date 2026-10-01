import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-[color,background-color,border-color,transform] duration-120 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 motion-reduce:active:scale-100";

// Semantic tokens only: these render on the light public site and the dark
// app, and must not assume either.
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-on hover:bg-accent-strong",
  secondary:
    "border border-line-strong bg-surface-2 text-text hover:bg-surface-3 hover:border-text-subtle",
  ghost: "text-text-muted hover:bg-surface-2 hover:text-text",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, className })}
      {...props}
    />
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
};

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClass({ variant, size, className })} {...props} />
  );
}
