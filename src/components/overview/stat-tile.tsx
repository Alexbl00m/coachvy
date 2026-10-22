import Link from "next/link";

/**
 * Ett nyckeltal: etikett i versaler, värdet stort och tunt, en rad
 * sammanhang. Hela rutan är en länk när den har ett mål, så att talet leder
 * till det det räknar.
 */
export function StatTile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="eyebrow text-text-subtle">{label}</p>
      <p className="mt-3 text-[2.75rem] font-light leading-none tracking-[-0.035em] text-text tabular-nums">
        {value}
      </p>
      {hint && (
        <p className="mt-2.5 truncate text-[0.8125rem] text-text-subtle">{hint}</p>
      )}
    </>
  );
  const className = "block min-w-0 bg-surface p-5 sm:p-6";
  return href ? (
    <Link
      href={href}
      className={`${className} transition-colors hover:bg-surface-2`}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
