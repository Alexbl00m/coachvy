import { cn } from "@/lib/cn";

const LABEL = {
  utkast: "Utkast",
  publicerad: "Publicerad",
  arkiverad: "Arkiverad",
} as const;

/** En versions status. Bara den publicerade sticker ut. */
export function StatusChip({
  status,
  version,
}: {
  status: keyof typeof LABEL;
  version?: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        status === "publicerad"
          ? "border-good/40 bg-good/10 text-good"
          : status === "utkast"
            ? "border-line-strong bg-surface-2 text-text"
            : "border-line text-text-subtle",
      )}
    >
      {LABEL[status]}
      {version !== undefined && (
        <span className="tabular-nums">v{version}</span>
      )}
    </span>
  );
}
