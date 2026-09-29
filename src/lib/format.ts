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

/**
 * Hur många decimaler ett värde tål, efter enhet.
 *
 * Watt, meter, procent och puls är heltal; farter och kvoter behöver
 * decimaler, W/kg två som i cyklingens rapporter. VDOT saknar enhet och visas
 * med en decimal, som i Daniels tabeller. Samlad här – fyra egna varianter
 * hade glidit isär.
 */
export function digitsForUnit(unit: string): number {
  if (["W", "m", "%", "ml/kg/min", "g/h", "slag/min", "J/W"].includes(unit))
    return 0;
  if (["kJ", "km/h", "mmol/l", ""].includes(unit)) return 1;
  return 2;
}

/**
 * Decimaler för ett värde, när storheten kräver mer än enheten säger.
 * Pacingen är procent men små tal – 1,3 % variation är inte 1 %.
 */
export function digitsForMetric(key: string, unit: string): number {
  if (key.startsWith("PACE_") || key === "LOSS_doubling") return 1;
  if (key === "FATIGUE_exp") return 3;
  return digitsForUnit(unit);
}
