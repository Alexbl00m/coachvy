import Link from "next/link";
import { Flag } from "lucide-react";

import { EmptyState } from "@/components/ui/card";
import { formatClock } from "@/lib/activities/analysis";
import type { ActivityListItem } from "@/lib/activities/queries";
import { routes } from "@/lib/routes";

const km = (m: number | null) =>
  m === null ? null : `${(m / 1000).toFixed(1).replace(".", ",")} km`;

/** Nyckeltalet som säger mest om passet i en rad. */
function keyFigure(a: ActivityListItem): string | null {
  const s = a.summary;
  if (a.sport === "cykling" && s.normalizedPower) {
    return `NP ${Math.round(s.normalizedPower)} W${s.intensityFactor ? ` · IF ${s.intensityFactor.toFixed(2).replace(".", ",")}` : ""}`;
  }
  if (s.avgSpeed) return `${s.avgSpeed.toFixed(1).replace(".", ",")} km/h`;
  return null;
}

/** Adeptens uppladdade pass och lopp, nyast först. */
export function ActivityList({
  adeptId,
  activities,
  raceNames,
}: {
  adeptId: string;
  activities: ActivityListItem[];
  raceNames: Record<string, string>;
}) {
  if (activities.length === 0) {
    return (
      <EmptyState
        title="Inga aktiviteter ännu"
        description="Ladda upp ett lopp eller pass ur klockan för att se karta, effekt, fart och puls – och hur det står sig mot testerna."
      />
    );
  }
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
      {activities.map((a) => (
        <li key={a.id}>
          <Link
            href={`${routes.adepts}/${adeptId}/aktivitet/${a.id}`}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-surface-2"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-medium text-text">
                {a.race_id && (
                  <Flag
                    aria-label="Tävling"
                    className="size-3.5 shrink-0 text-accent"
                  />
                )}
                <span className="truncate">{a.name}</span>
              </span>
              <span className="block text-[12px] text-text-subtle">
                {a.performed_on}
                {a.race_id &&
                raceNames[a.race_id] &&
                a.name !== raceNames[a.race_id]
                  ? ` · ${raceNames[a.race_id]}`
                  : ""}
              </span>
            </span>
            <span className="flex gap-4 text-sm text-text-muted tabular-nums">
              {[
                km(a.distance_m),
                a.duration_s ? formatClock(a.duration_s) : null,
                keyFigure(a),
              ]
                .filter(Boolean)
                .map((v) => (
                  <span key={v}>{v}</span>
                ))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
