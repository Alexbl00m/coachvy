import Link from "next/link";

import { ZoneSuggestionButtons } from "@/components/tests/zone-suggestion-buttons";
import { Card, CardTitle } from "@/components/ui/card";
import { spanLabel } from "@/lib/activities/profile";
import { formatPacePerKm } from "@/lib/calculators/time";
import { routes } from "@/lib/routes";
import type { ZoneSuggestion } from "@/lib/tests/zone-suggestion";
import { zoneSuggestionsFor } from "@/lib/tests/zone-suggestion-queries";

const sv = (v: number, digits = 0) =>
  v.toLocaleString("sv-SE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    day: "numeric",
    month: "short",
  }).format(new Date(`${iso}T12:00:00Z`));

/** CP i W, eller CS som tempo per km. */
const show = (s: ZoneSuggestion, v: number) =>
  s.kind === "power" ? `${sv(v)} W` : `${formatPacePerKm(v)} /km`;

function Suggestion({ adeptId, s }: { adeptId: string; s: ZoneSuggestion }) {
  const power = s.kind === "power";
  const name = power ? "CP" : "CS";
  const reserve = power
    ? `W′ ${sv(s.reserve / 1000, 1)} kJ`
    : `D′ ${sv(s.reserve)} m`;
  return (
    <section aria-labelledby={`zon-${s.sport}`} className="min-w-0">
      <h3
        id={`zon-${s.sport}`}
        className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-text"
      >
        {power ? "Cykling" : "Löpning"}: {name} {show(s, s.critical)}
        <span className="text-[13px] font-normal text-text-muted tabular-nums">
          +{sv(s.changePct, 1)} % mot testet
        </span>
      </h3>
      <p className="mt-1 text-sm text-text">
        De bästa insatserna på 3–20 minuter de senaste 90 dagarna ger {name}{" "}
        {show(s, s.critical)} och {reserve}. Senaste testet
        {s.testedOn ? ` (${shortDate(s.testedOn)})` : ""} gav{" "}
        {show(s, s.previous)}.
        {power &&
          ` FTP-zonerna utgår då från ${sv(s.critical * 0.95)} W i stället för ${sv(s.previous * 0.95)} W.`}
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[22rem] text-[13px] tabular-nums">
          <caption className="sr-only">Insatserna förslaget bygger på</caption>
          <thead>
            <tr className="text-left text-text-muted">
              <th scope="col" className="py-1 pr-3 font-normal">
                Längd
              </th>
              <th scope="col" className="py-1 pr-3 font-normal">
                {power ? "Effekt" : "Tempo"}
              </th>
              <th scope="col" className="py-1 pr-3 font-normal">
                Dag
              </th>
              <th scope="col" className="py-1 font-normal">
                Pass
              </th>
            </tr>
          </thead>
          <tbody>
            {s.efforts.map((e) => (
              <tr key={e.span} className="border-t border-line">
                <td className="py-1.5 pr-3 text-text">{spanLabel(e.span)}</td>
                <td className="py-1.5 pr-3 text-text">{show(s, e.value)}</td>
                <td className="py-1.5 pr-3 text-text-muted">
                  {shortDate(e.date)}
                  {s.testedOn && e.date > s.testedOn ? (
                    <span className="sr-only"> (efter testet)</span>
                  ) : null}
                </td>
                <td className="max-w-[14rem] truncate py-1.5">
                  <Link
                    href={`${routes.adepts}/${adeptId}/aktivitet/${e.activityId}`}
                    className="text-text-muted hover:text-text hover:underline"
                    title={e.name}
                  >
                    {e.name}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ZoneSuggestionButtons
        adeptId={adeptId}
        sport={s.sport}
        testName={power ? "CP-test" : "CS-test"}
      />
    </section>
  );
}

/**
 * Zonförslaget för coachen: när träningen visar en tydligt högre CP (CS) än
 * senaste testet. Visas bara när det finns något att besluta om.
 */
export async function ZoneSuggestionCard({
  adeptId,
  today,
}: {
  adeptId: string;
  today: string;
}) {
  const { suggestions } = await zoneSuggestionsFor(adeptId, today);
  if (suggestions.length === 0) return null;
  return (
    <Card className="min-w-0">
      <CardTitle>Nya zoner ur träningen?</CardTitle>
      <div className="space-y-6">
        {suggestions.map((s) => (
          <Suggestion key={s.sport} adeptId={adeptId} s={s} />
        ))}
      </div>
    </Card>
  );
}
