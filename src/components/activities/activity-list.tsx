import Link from "next/link";
import { Flag } from "lucide-react";

import { EmptyState } from "@/components/ui/card";
import { formatClock } from "@/lib/activities/analysis";
import type { ActivityHead } from "@/lib/activities/queries";
import { routes } from "@/lib/routes";

const km = (m: number | null) =>
  m === null ? null : `${(m / 1000).toFixed(1).replace(".", ",")} km`;

/** Nyckeltalet som säger mest om passet i en rad. */
function keyFigure(a: ActivityHead): string | null {
  if (a.sport === "cykling" && a.normalized_power) {
    return `NP ${Math.round(a.normalized_power)} W${a.intensity_factor ? ` · IF ${a.intensity_factor.toFixed(2).replace(".", ",")}` : ""}`;
  }
  if (a.avg_speed) return `${a.avg_speed.toFixed(1).replace(".", ",")} km/h`;
  return null;
}

/** Adeptens uppladdade pass och lopp, nyast först. */
export function ActivityList({
  adeptId,
  activities,
  total,
  moreHref,
  raceNames,
}: {
  adeptId: string;
  activities: ActivityHead[];
  /** Alla aktiviteter, när listan bara visar de senaste. */
  total?: number;
  moreHref?: string;
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
  const hidden = (total ?? activities.length) - activities.length;
  return (
    <div>
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
                  {a.imported ? " · ur historiken" : ""}
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
      {hidden > 0 && moreHref && (
        <Link
          href={moreHref}
          className="mt-3 inline-block text-[13px] text-accent-text hover:text-accent-hover"
        >
          Visa alla {total} aktiviteter
        </Link>
      )}
    </div>
  );
}
