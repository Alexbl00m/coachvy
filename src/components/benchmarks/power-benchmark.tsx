"use client";

import { useMemo, useState } from "react";

import {
  LevelChart,
  type LevelColumn,
} from "@/components/benchmarks/level-chart";
import { Card, CardTitle } from "@/components/ui/card";
import {
  inPeriod,
  PERIODS,
  periodRange,
  type ProfileSource,
} from "@/lib/activities/profile";
import {
  COGGAN_CATEGORIES,
  cogganCategory,
  DURATION_LABEL,
  readPowerProfile,
  type Sex,
} from "@/lib/benchmarks/coggan";
import {
  PROFILE_SPANS,
  powerProfileRows,
  profileCaveats,
  THIN_SUPPORT,
  type ProfileRow,
} from "@/lib/benchmarks/power-profile";
import { cn } from "@/lib/cn";

const sv = (v: number, digits = 0) => v.toFixed(digits).replace(".", ",");

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));

const CHOICES = PERIODS.filter((p) => p.key !== "6v");

/**
 * Effektprofilen mot Allen & Coggans tabell: bästa effekt per kilo över 5 s,
 * 1 min, 5 min, 20 min och vid tröskeln, placerad bland tabellens kategorier.
 *
 * Underlaget är bästa-kurvan ur träningen i den valda perioden. Tröskeln (FT)
 * tas som det högsta av FTP ur ett test i perioden, bästa timmen och 95 % av
 * bästa 20 minuterna – en kurva ur träning visar vad adepten minst klarar.
 */
export function PowerBenchmark({
  sources,
  weightKg,
  weightDate,
  sex,
  testFtp,
  today,
}: {
  sources: ProfileSource[];
  weightKg: number | null;
  weightDate: string | null;
  /** null när könet inte är känt – då jämförs mot männens tabell. */
  sex: Sex | null;
  testFtp: { watts: number; date: string } | null;
  today: string;
}) {
  const [periodKey, setPeriodKey] = useState(() => {
    for (const p of CHOICES) {
      const r = periodRange(p.days, today);
      if (inPeriod(sources, "power", r.from, r.to).length >= 3) return p.key;
    }
    return "allt";
  });
  const period = CHOICES.find((p) => p.key === periodKey) ?? CHOICES[2];
  const range = periodRange(period.days, today);
  const table: Sex = sex ?? "man";

  const rows = useMemo(
    (): ProfileRow[] =>
      weightKg
        ? powerProfileRows({
            sources,
            weightKg,
            sex: table,
            testFtp,
            from: range.from,
            to: range.to,
          })
        : [],
    [sources, weightKg, range.from, range.to, testFtp, table],
  );

  if (inPeriod(sources, "power", null, null).length === 0) return null;

  const caveats = profileCaveats(rows);
  const reading = [
    ...caveats.lines,
    ...(caveats.readable ? readPowerProfile(rows) : []),
  ];
  const columns: LevelColumn[] = [
    ...PROFILE_SPANS,
    { duration: "ft" as const, span: 0, sub: "FTP" },
  ].map(({ duration, sub }) => {
    const row = rows.find((r) => r.duration === duration);
    const category = row ? cogganCategory(row.position) : null;
    return {
      key: duration,
      label: DURATION_LABEL[duration],
      sublabel: sub,
      position: row ? row.position : null,
      value: row ? sv(row.wattsPerKg, row.wattsPerKg >= 10 ? 1 : 2) : "",
      unit: "W/kg",
      detail: row
        ? `${sv(row.watts)} W · ${category?.name}${category?.outside ? ` (${category.outside} tabellen)` : ""} · ${row.source}${row.date ? `, ${longDate(row.date)}` : ""}`
        : undefined,
    };
  });

  return (
    <Card className="min-w-0">
      <CardTitle
        action={
          <div className="flex flex-wrap justify-end gap-1.5">
            {CHOICES.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={periodKey === p.key}
                onClick={() => setPeriodKey(p.key)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[13px] transition-colors",
                  periodKey === p.key
                    ? "border-text-subtle bg-surface-3 text-text"
                    : "border-line-strong text-text-muted hover:text-text",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      >
        Effektprofil mot referens
      </CardTitle>

      {!weightKg ? (
        <p className="text-sm text-text-muted">
          Effektprofilen jämförs i watt per kilo, och ingen vikt finns. Lägg in
          vikten på ett cykeltest så räknas profilen fram.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-text-muted">
          Inga cykelpass med effekt i perioden. Välj en längre period.
        </p>
      ) : (
        <>
          <p className="max-w-3xl text-[13px] leading-relaxed text-text-subtle">
            Bästa effekt per kilo{" "}
            {range.from
              ? `mellan ${longDate(range.from)} och ${longDate(range.to)}`
              : "i hela historiken"}{" "}
            mot Allen &amp; Coggans tabell för{" "}
            {table === "man" ? "män" : "kvinnor"}
            {sex === null ? " (kön saknas i profilen)" : ""}. Vikt{" "}
            {sv(weightKg, 1).replace(",0", "")} kg
            {weightDate ? ` ur testet ${longDate(weightDate)}` : ""}. Samma höjd
            i alla kolumner är samma kategori.
          </p>

          <div className="mt-4">
            <LevelChart
              levels={[...COGGAN_CATEGORIES]}
              kind="bands"
              columns={columns}
              height={320}
              ariaLabel={`Effektprofil mot Coggans tabell: ${rows
                .map(
                  (r) =>
                    `${DURATION_LABEL[r.duration]} ${sv(r.wattsPerKg, 2)} W/kg, ${cogganCategory(r.position).name.toLowerCase()}`,
                )
                .join("; ")}.`}
            />
          </div>

          {reading.length > 0 && (
            <ul className="mt-4 max-w-3xl space-y-1.5 text-sm leading-relaxed text-text-muted">
              {reading.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-sm whitespace-nowrap tabular-nums">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-text-muted">
                  <th className="py-2 pr-3 font-medium">Längd</th>
                  <th className="py-2 pr-3 text-right font-medium">Effekt</th>
                  <th className="py-2 pr-3 text-right font-medium">W/kg</th>
                  <th className="py-2 pr-3 font-medium">Kategori</th>
                  <th className="py-2 font-medium">Ur</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const category = cogganCategory(r.position);
                  return (
                    <tr
                      key={r.duration}
                      className="border-b border-line last:border-0"
                    >
                      <td className="py-2 pr-3 text-text-muted">
                        {DURATION_LABEL[r.duration]}
                      </td>
                      <td className="py-2 pr-3 text-right text-text">
                        {sv(r.watts)} W
                      </td>
                      <td className="py-2 pr-3 text-right font-medium text-text">
                        {sv(r.wattsPerKg, 2)}
                      </td>
                      <td className="py-2 pr-3 text-text">
                        {category.name}
                        {category.outside && (
                          <span className="text-text-subtle">
                            {" "}
                            · {category.outside} tabellen
                          </span>
                        )}
                      </td>
                      <td className="max-w-[16rem] truncate py-2 text-text-subtle">
                        {r.source}
                        {r.date ? `, ${longDate(r.date)}` : ""}
                        {r.support < THIN_SUPPORT && (
                          <span className="text-warn"> · tunt underlag</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[12px] leading-relaxed text-text-subtle">
            Källa: Allen &amp; Coggan,{" "}
            <i>Training and Racing with a Power Meter</i> – kategoriernas nedre
            gränser. 20 minuter jämförs mot tröskelns gränser delade med 0,95.
            Coggans exempel: Utmärkt ≈ kat 1, Exceptionell ≈ nationell
            proffsnivå, Världsklass ≈ internationell. En kurva ur träning visar
            vad adepten minst klarar – utan riktiga spurter eller maximala
            intervaller i perioden hamnar de längderna för lågt.
          </p>
        </>
      )}
    </Card>
  );
}
