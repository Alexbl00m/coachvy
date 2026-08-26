/**
 * `tested_on` is a plain `date` column, and Swedish date format is already
 * ISO (YYYY-MM-DD), so dates need no locale conversion — which also keeps
 * server and client markup identical.
 */
export function formatDate(value: string | null): string {
  if (!value) return "–";
  return value.slice(0, 10);
}

/**
 * Relative wording for "senast aktiv". Only called from Server Components, so
 * the comparison against `now` never causes a hydration mismatch.
 */
export function formatLastActive(value: string | null): string {
  if (!value) return "Aldrig inloggad";

  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return "–";

  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return "Idag";
  if (days === 1) return "Igår";
  if (days < 30) return `För ${days} dagar sedan`;
  return formatDate(value);
}

/** Trims trailing zeros so 280.00 reads as 280 but 4.25 keeps its decimals. */
export function formatValue(value: number): string {
  return String(Number(value)).replace(".", ",");
}
