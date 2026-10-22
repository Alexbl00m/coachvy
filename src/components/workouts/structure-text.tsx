import { zoneByKey } from "@/lib/plan-library/zones";
import { zoneOf } from "@/lib/workouts/intensity";
import type { TargetBasis } from "@/lib/workouts/schema";

const TOKEN =
  /(@[A-Za-z0-9]+(?:-[A-Za-z0-9]+)?|\d+(?:[.,]\d+)?(?:-\d+(?:[.,]\d+)?)?%)/g;

/** Zonen för ett mål i raden: `@LO`, `@HM-10K` eller `75-80%`. */
function zoneOfToken(token: string, basis: TargetBasis | null) {
  if (token.startsWith("@")) {
    const [a, b] = token.slice(1).split("-");
    const from = zoneByKey(a);
    const to = b ? zoneByKey(b) : from;
    if (!from || !to) return null;
    // Namngivna zoner är andelar av maratonfarten.
    return zoneOf((from.low + to.high) / 2, "MP");
  }
  if (!basis) return null;
  const [low, high = low] = token
    .slice(0, -1)
    .split("-")
    .map((n) => Number(n.replace(",", ".")) / 100);
  return zoneOf((low + high) / 2, basis);
}

/**
 * Passets struktur som en rad i mono, med målen i sina zonfärger:
 * "2 km @LO; 3×(5 min @HM-10K + 2 min @RK); 2 km @LO".
 */
export function StructureText({
  text,
  basis = null,
}: {
  text: string;
  basis?: TargetBasis | null;
}) {
  const parts = text.replace(/(\d)x\(/g, "$1×(").split(TOKEN);
  return (
    <p className="font-mono text-[13px] leading-relaxed text-text-muted sm:text-sm">
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        const zone = zoneOfToken(part, basis);
        return (
          <span
            key={i}
            className="font-medium"
            style={zone ? { color: `var(--zone-${zone}-text)` } : undefined}
          >
            {part}
          </span>
        );
      })}
    </p>
  );
}
