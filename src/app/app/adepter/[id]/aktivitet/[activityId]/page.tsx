import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Flag } from "lucide-react";

import { ActivityEditor } from "@/components/activities/activity-editor";
import { ActivityExplorer } from "@/components/activities/activity-explorer";
import { PageHeader } from "@/components/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { getAdept } from "@/lib/adepts/queries";
import { requireSessionUser } from "@/lib/auth/session";
import { getActivity } from "@/lib/activities/queries";
import {
  formatClock,
  paceOf,
  type Summary,
  type ZoneTime,
} from "@/lib/activities/analysis";
import { SERIES } from "@/lib/calculators/chart-colors";
import { routes } from "@/lib/routes";
import { listRaces } from "@/lib/season/queries";
import { longDate } from "@/lib/season/season";

export const metadata = { title: "Aktivitet" };

const sv = (v: number, digits = 0) =>
  v.toFixed(digits).replace(".", ",").replace("-", "−");

type Tile = { label: string; value: string; unit?: string; hint?: string };

function tilesFor(s: Summary, sport: string): Tile[] {
  const running = sport === "löpning";
  const tiles: (Tile | null)[] = [
    {
      label: "Tid",
      value: formatClock(s.elapsedS),
      hint:
        s.movingS < s.elapsedS - 30
          ? `${formatClock(s.movingS)} i rörelse`
          : undefined,
    },
    s.distanceM !== null
      ? { label: "Distans", value: sv(s.distanceM / 1000, 1), unit: "km" }
      : null,
    s.avgSpeed !== null
      ? running
        ? {
            label: "Tempo",
            value: paceOf(s.avgSpeed / 3.6),
            unit: "/km",
            hint: `${sv(s.avgSpeed, 1)} km/h i snitt`,
          }
        : {
            label: "Snittfart",
            value: sv(s.avgSpeed, 1),
            unit: "km/h",
            hint: s.maxSpeed ? `max ${sv(s.maxSpeed, 1)} km/h` : undefined,
          }
      : null,
    s.ascentM !== null && s.ascentM > 0
      ? { label: "Stigning", value: sv(s.ascentM), unit: "m" }
      : null,
    s.normalizedPower !== null
      ? {
          label: "Normaliserad effekt",
          value: sv(s.normalizedPower),
          unit: "W",
          hint: s.avgPower
            ? `snitt ${sv(s.avgPower)} W · VI ${sv(s.variabilityIndex ?? 1, 2)}`
            : undefined,
        }
      : null,
    s.intensityFactor !== null
      ? {
          label: "Intensitet",
          value: `IF ${sv(s.intensityFactor, 2)}`,
          hint: s.tss !== null ? `TSS ${sv(s.tss)}` : undefined,
        }
      : null,
    s.avgHr !== null
      ? {
          label: "Puls",
          value: sv(s.avgHr),
          unit: "snitt",
          hint: s.maxHr ? `max ${sv(s.maxHr)} slag/min` : undefined,
        }
      : null,
    s.workKj !== null
      ? {
          label: "Arbete",
          value: sv(s.workKj),
          unit: "kJ",
          hint: "≈ lika många kcal",
        }
      : null,
  ];
  return tiles.filter((t): t is Tile => t !== null);
}

/** Tid i zon som liggande staplar: längden är andelen, värdet står vid spetsen. */
function ZoneBars({ zones }: { zones: ZoneTime[] }) {
  const total = zones.reduce((sum, z) => sum + z.seconds, 0) || 1;
  const max = Math.max(...zones.map((z) => z.seconds), 1);
  return (
    <ul className="space-y-2">
      {zones.map((z) => (
        <li
          key={z.zone}
          className="grid grid-cols-[minmax(0,8.5rem)_1fr] items-center gap-3 text-[13px]"
        >
          <span className="truncate text-text-muted">{z.zone}</span>
          <span className="flex items-center gap-2">
            <span
              className="h-3 rounded-r-[4px]"
              style={{
                width: `${(z.seconds / max) * 78}%`,
                minWidth: z.seconds > 0 ? 2 : 0,
                background: SERIES.primary,
              }}
            />
            <span className="whitespace-nowrap text-text tabular-nums">
              {formatClock(z.seconds)}
              <span className="text-text-subtle">
                {" "}
                · {sv((z.seconds / total) * 100)} %
              </span>
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

type Lap = {
  seconds: number;
  distanceM: number | null;
  power: number | null;
  hr: number | null;
};

/**
 * Ett genomfört pass eller lopp: karta, grafer, bästa insatser mot testets
 * modell, zoner och delsträckor.
 *
 * Allt är räknat när filen laddades upp, mot de testvärden som gällde då.
 * Sidan räknar inte om – ett lopp i juli ska läsas mot vårens test även när
 * det öppnas efter höstens.
 */
export default async function ActivityPage({
  params,
}: PageProps<"/app/adepter/[id]/aktivitet/[activityId]">) {
  const user = await requireSessionUser();
  const { id, activityId } = await params;
  const [adept, activity, races] = await Promise.all([
    getAdept(id),
    getActivity(activityId),
    listRaces(id),
  ]);
  if (!adept || !activity || activity.adept_id !== adept.id) notFound();

  const canEdit =
    (user.profile?.role === "coach" && adept.coach_id === user.id) ||
    adept.profile_id === user.id;
  const s = activity.summary;
  const ref = activity.reference;
  const race = races.find((r) => r.id === activity.race_id) ?? null;
  const running = activity.sport === "löpning";
  const laps = ((activity.laps ?? []) as Lap[]).filter((l) => l.seconds > 0);
  const ftp = ref?.ftp ?? null;

  return (
    <>
      <Link
        href={`${routes.adepts}/${adept.id}?vy=aktiviteter`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {adept.full_name}
      </Link>

      <PageHeader
        title={activity.name}
        description={[
          longDate(activity.performed_on),
          new Intl.DateTimeFormat("sv-SE", {
            timeZone: "Europe/Stockholm",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(activity.started_at)),
          activity.device,
        ]
          .filter(Boolean)
          .join(" · ")}
        action={
          race ? (
            <Link
              href={`${routes.plans}?adept=${adept.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-[13px] text-text-muted hover:border-accent hover:text-text"
            >
              <Flag aria-hidden className="size-3.5 text-accent" />
              {race.name} · {race.priority}-lopp
            </Link>
          ) : activity.is_race ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-[13px] text-text-muted">
              <Flag aria-hidden className="size-3.5 text-accent" />
              Oplanerad tävling
            </span>
          ) : undefined
        }
      />

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tilesFor(s, activity.sport).map((t) => (
            <div
              key={t.label}
              className="min-w-0 rounded-lg border border-line bg-surface p-4"
            >
              <p className="text-[12px] font-medium text-text-muted">
                {t.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-text">
                {t.value}
                {t.unit && (
                  <span className="ml-1 text-sm font-normal text-text-muted">
                    {t.unit}
                  </span>
                )}
              </p>
              {t.hint && (
                <p className="mt-0.5 truncate text-[12px] text-text-subtle">
                  {t.hint}
                </p>
              )}
            </div>
          ))}
        </div>

        {s.insights.length > 0 && (
          <Card>
            <CardTitle>Analys</CardTitle>
            <ul className="max-w-3xl space-y-2.5 text-[15px] leading-relaxed text-text">
              {s.insights.map((line) => (
                <li key={line} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent"
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            {activity.note && (
              <p className="mt-4 max-w-3xl border-t border-line pt-4 text-sm text-text-muted">
                {activity.note}
              </p>
            )}
          </Card>
        )}

        <ActivityExplorer
          streams={activity.streams}
          sport={activity.sport}
          ftp={running ? null : ftp}
          lthr={ref?.lthr ?? null}
          best={s.best}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {s.best.length > 0 && (
            <Card>
              <CardTitle>Bästa insatser mot testet</CardTitle>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm tabular-nums">
                  <thead>
                    <tr className="border-b border-line text-left text-[12px] uppercase tracking-[0.08em] text-text-muted">
                      <th className="py-2 pr-3 font-medium">
                        {running ? "Distans" : "Längd"}
                      </th>
                      <th className="py-2 pr-3 text-right font-medium">
                        I loppet
                      </th>
                      <th className="py-2 pr-3 text-right font-medium">
                        Modellen
                      </th>
                      <th className="py-2 text-right font-medium">Skillnad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.best.map((b) => {
                      const diff =
                        b.model !== null
                          ? running
                            ? ((b.model - b.value) / b.model) * 100
                            : ((b.value - b.model) / b.model) * 100
                          : null;
                      return (
                        <tr
                          key={b.label}
                          className="border-b border-line last:border-0"
                        >
                          <td className="py-2 pr-3 text-text-muted">
                            {b.label}
                          </td>
                          <td className="py-2 pr-3 text-right font-medium text-text">
                            {running
                              ? formatClock(b.value)
                              : `${sv(b.value)} W`}
                          </td>
                          <td className="py-2 pr-3 text-right text-text-muted">
                            {b.model === null
                              ? "–"
                              : running
                                ? formatClock(b.model)
                                : `${sv(b.model)} W`}
                          </td>
                          <td className="py-2 text-right">
                            {diff === null ? (
                              <span className="text-text-subtle">–</span>
                            ) : (
                              <span
                                className={
                                  diff >= 2 ? "text-good" : "text-text-muted"
                                }
                              >
                                {diff >= 2 ? "▲ " : ""}
                                {diff > 0 ? "+" : ""}
                                {sv(diff, 1)} %
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[12px] text-text-subtle">
                {running
                  ? "Modellen är tiden CS och D′ ur testet förutsäger för distansen. Plus betyder snabbare än modellen."
                  : "Modellen är CP + W′/tid ur testet, från en minut och uppåt. Plus betyder mer än modellen."}
              </p>
            </Card>
          )}

          {(s.powerZones || s.hrZones) && (
            <Card>
              <CardTitle>Tid i zon</CardTitle>
              <div className="space-y-6">
                {s.powerZones && (
                  <div>
                    <p className="mb-2 text-[12px] text-text-subtle">
                      Effekt mot FTP {ftp ? `${sv(ftp)} W` : ""}
                    </p>
                    <ZoneBars zones={s.powerZones} />
                  </div>
                )}
                {s.hrZones && (
                  <div>
                    <p className="mb-2 text-[12px] text-text-subtle">
                      Puls mot tröskelpuls {ref?.lthr ? sv(ref.lthr) : ""}
                    </p>
                    <ZoneBars zones={s.hrZones} />
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {s.splits.length > 1 && (
          <Card>
            <CardTitle>
              {running ? "Kilometer för kilometer" : "Var tionde kilometer"}
            </CardTitle>
            <div className="relative overflow-x-auto">
              <table
                className="w-full border-collapse text-sm tabular-nums"
                style={{ minWidth: 520 }}
              >
                <thead>
                  <tr className="border-b border-line text-left text-[12px] uppercase tracking-[0.08em] text-text-muted">
                    <th className="py-2 pr-3 font-medium">Till</th>
                    <th className="py-2 pr-3 text-right font-medium">Tid</th>
                    <th className="py-2 pr-3 text-right font-medium">
                      {running ? "Tempo" : "Fart"}
                    </th>
                    <th className="py-2 pr-3 text-right font-medium">Effekt</th>
                    <th className="py-2 pr-3 text-right font-medium">Puls</th>
                    <th className="py-2 text-right font-medium">Stigning</th>
                  </tr>
                </thead>
                <tbody>
                  {s.splits.map((sp) => (
                    <tr
                      key={sp.label}
                      className="border-b border-line last:border-0"
                    >
                      <td className="py-2 pr-3 text-text-muted">{sp.label}</td>
                      <td className="py-2 pr-3 text-right text-text">
                        {formatClock(sp.seconds)}
                      </td>
                      <td className="py-2 pr-3 text-right text-text">
                        {sp.speed === null
                          ? "–"
                          : running
                            ? `${paceOf(sp.speed / 3.6)}/km`
                            : `${sv(sp.speed, 1)} km/h`}
                      </td>
                      <td className="py-2 pr-3 text-right text-text">
                        {sp.power === null ? "–" : `${sv(sp.power)} W`}
                      </td>
                      <td className="py-2 pr-3 text-right text-text">
                        {sp.hr === null ? "–" : sv(sp.hr)}
                      </td>
                      <td className="py-2 text-right text-text-muted">
                        {sp.ascent === null ? "–" : `${sv(sp.ascent)} m`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {laps.length > 1 && (
          <Card>
            <CardTitle>Varv från klockan</CardTitle>
            <div className="relative overflow-x-auto">
              <table
                className="w-full border-collapse text-sm tabular-nums"
                style={{ minWidth: 420 }}
              >
                <thead>
                  <tr className="border-b border-line text-left text-[12px] uppercase tracking-[0.08em] text-text-muted">
                    <th className="py-2 pr-3 font-medium">Varv</th>
                    <th className="py-2 pr-3 text-right font-medium">Tid</th>
                    <th className="py-2 pr-3 text-right font-medium">
                      Distans
                    </th>
                    <th className="py-2 pr-3 text-right font-medium">Effekt</th>
                    <th className="py-2 text-right font-medium">Puls</th>
                  </tr>
                </thead>
                <tbody>
                  {laps.map((lap, n) => (
                    <tr key={n} className="border-b border-line last:border-0">
                      <td className="py-2 pr-3 text-text-muted">{n + 1}</td>
                      <td className="py-2 pr-3 text-right text-text">
                        {formatClock(lap.seconds)}
                      </td>
                      <td className="py-2 pr-3 text-right text-text">
                        {lap.distanceM === null
                          ? "–"
                          : `${sv(lap.distanceM / 1000, 2)} km`}
                      </td>
                      <td className="py-2 pr-3 text-right text-text">
                        {lap.power === null ? "–" : `${sv(lap.power)} W`}
                      </td>
                      <td className="py-2 text-right text-text">
                        {lap.hr === null ? "–" : sv(lap.hr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card>
          <CardTitle>Underlaget</CardTitle>
          <p className="max-w-3xl text-sm text-text-muted">
            {ref && (ref.ftp || ref.cp || ref.cs || ref.lthr)
              ? `Analysen räknades mot ${[
                  ref.ftp && !running
                    ? `FTP ${sv(ref.ftp)} W${ref.ftpSource ? ` (${ref.ftpSource})` : ""}`
                    : null,
                  ref.cp ? `CP ${sv(ref.cp)} W` : null,
                  ref.wPrime ? `W′ ${sv(ref.wPrime / 1000, 1)} kJ` : null,
                  ref.cs ? `CS ${sv(ref.cs * 3.6, 1)} km/h` : null,
                  ref.dPrime ? `D′ ${sv(ref.dPrime)} m` : null,
                  ref.lthr ? `tröskelpuls ${sv(ref.lthr)}` : null,
                ]
                  .filter(Boolean)
                  .join(
                    ", ",
                  )}${ref.testedOn ? `, ur testen fram till ${ref.testedOn}` : ""}. Värdena står kvar även när nya tester görs; ta bort aktiviteten och ladda upp filen igen för att räkna mot dem.`
              : "Det fanns inga testvärden att räkna mot när filen laddades upp, så zoner, IF och W′bal saknas. Gör ett test, ta bort aktiviteten och ladda upp filen igen."}
            {s.imported &&
              " Passet kom in i en historikimport och sparades med en glesare serie, så kartan och graferna är grövre än för ett pass som laddats upp för sig. Siffrorna ovan är räknade på hela filen."}
          </p>
        </Card>

        {canEdit && (
          <Card>
            <CardTitle>Redigera</CardTitle>
            <ActivityEditor
              id={activity.id}
              adeptId={adept.id}
              name={activity.name}
              note={activity.note}
              raceId={activity.race_id}
              isRace={activity.is_race}
              races={races.map((r) => ({
                id: r.id,
                name: r.name,
                race_date: r.race_date,
              }))}
            />
          </Card>
        )}
      </div>
    </>
  );
}
