/**
 * Tid- och tempoformatering, delad av alla kalkyler.
 *
 * Originalets `parseTimeInput` returnerade minuter men tolkade tal under 1 som
 * timmar ("0.0666 ≈ 4 minuter"), vilket gjorde 0,5 minuter omöjligt att mata
 * in. Här är kontraktet i stället entydigt: "mm:ss" eller ett antal minuter.
 */

/** Minuter från "mm:ss", "m:ss" eller ett decimaltal. NaN när något är fel. */
export function parseMinutes(input: string): number {
  const trimmed = input.trim().replace(",", ".");
  if (!trimmed) return Number.NaN;

  if (trimmed.includes(":")) {
    const [minutePart, secondPart = "0"] = trimmed.split(":");
    const minutes = Number(minutePart);
    const seconds = Number(secondPart);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return Number.NaN;
    if (seconds < 0 || seconds >= 60) return Number.NaN;
    return minutes + seconds / 60;
  }

  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}

/** Sekunder som "h:mm:ss" eller "m:ss". */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "–";

  // Avrunda hela talet först: annars kan sekunderna avrundas till 60 och ge
  // "3:60" i stället för "4:00".
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/** m/s som tempo per kilometer, "m:ss". */
export function formatPacePerKm(metresPerSecond: number): string {
  if (!Number.isFinite(metresPerSecond) || metresPerSecond <= 0) return "–";
  return `${formatDuration(1000 / metresPerSecond)}`;
}

/** m/s som tempo per 100 meter — simningens enhet. */
export function formatPacePer100m(metresPerSecond: number): string {
  if (!Number.isFinite(metresPerSecond) || metresPerSecond <= 0) return "–";
  return `${formatDuration(100 / metresPerSecond)}`;
}
