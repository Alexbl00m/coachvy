import Link from "next/link";

/**
 * Ett nyckeltal: etikett, värde och en rad sammanhang. Hela rutan är en länk
 * när den har ett mål, så att talet leder till det det räknar.
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
      <p className="text-[12px] font-medium text-text-muted">{label}</p>
      <p className="mt-1.5 text-3xl font-semibold tracking-tight text-text">
        {value}
      </p>
      {hint && (
        <p className="mt-1 truncate text-[12px] text-text-subtle">{hint}</p>
      )}
    </>
  );
  const className =
    "block min-w-0 rounded-lg border border-line bg-surface p-4 sm:p-5";
  return href ? (
    <Link
      href={href}
      className={`${className} transition-colors hover:border-line-strong`}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
