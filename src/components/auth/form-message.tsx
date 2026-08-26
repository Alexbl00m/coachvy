import { AlertCircle, CheckCircle2 } from "lucide-react";

export function FormMessage({
  error,
  notice,
}: {
  error?: string;
  notice?: string;
}) {
  if (!error && !notice) return null;

  const isError = Boolean(error);
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <p
      role={isError ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-[13px] ${
        isError
          ? "border-red-500/40 bg-red-500/10 text-red-200"
          : "border-accent/40 bg-accent-soft text-ink-100"
      }`}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{error ?? notice}</span>
    </p>
  );
}
