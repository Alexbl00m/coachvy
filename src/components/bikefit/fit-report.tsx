import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { DISCIPLINE_LABEL } from "@/lib/bikefit/fit";
import {
  assessFit,
  TEMPLATES,
  TOLERANCE,
  type Assessed,
  type Assessment,
} from "@/lib/bikefit/templates";
import { longDate } from "@/lib/season/season";
import type { BikeFitRow } from "@/lib/types/database";
import { VERDICT_BORDER, VERDICT_TEXT } from "./verdict-style";

const sv = (v: number, d = 1) =>
  v.toFixed(d).replace(".", ",").replace("-", "−");

/** Bedömningen av en sparad fit, med benen den mättes med. */
export function assessmentOf(fit: BikeFitRow): Assessment {
  return assessFit(
    {
      knee: fit.angles.knee ?? null,
      trunk: fit.angles.trunk ?? null,
      elbow: fit.angles.elbow ?? null,
      shoulder: fit.angles.shoulder ?? null,
      hip: fit.angles.hip ?? null,
    },
    fit.bands,
    {
      thighMm: fit.legs.thighMm ?? null,
      shankMm: fit.legs.shankMm ?? null,
      source: fit.legs.source,
    },
  );
}

/** En ruta per vinkel: namn och omdöme, värdet stort, bandet litet. */
export function AngleTile({
  title,
  a,
  previous,
  manual = false,
}: {
  title: string;
  a: Assessed;
  previous?: number | null;
  /** Manuellt införd: ett tomt värde är inte angivet, inte omätbart. */
  manual?: boolean;
}) {
  const change =
    a.value !== null && previous !== null && previous !== undefined
      ? a.value - previous
      : null;
  const label = a.value === null && manual ? "inte angivet" : a.label;
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border bg-surface p-4",
        a.verdict ? VERDICT_BORDER[a.verdict] : "border-line",
      )}
    >
      <p className="text-[12px] font-medium leading-snug text-text-muted">
        {title}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-text tabular-nums">
        {a.value === null ? "–" : `${sv(a.value)}°`}
      </p>
      <p
        className={cn(
          "text-[12px] font-medium",
          a.verdict ? VERDICT_TEXT[a.verdict] : "text-text-subtle",
        )}
      >
        {label}
      </p>
      <p className="mt-1 text-[12px] text-text-subtle tabular-nums">
        {a.band
          ? `mål ${a.band.min}–${a.band.max}°${a.basis === "erfarenhetsvärde" ? " · erfarenhetsvärde" : ""}`
          : "mäts, bedöms inte"}
        {change !== null && Math.abs(change) >= 0.1
          ? ` · ${change > 0 ? "+" : ""}${sv(change)}° sedan förra`
          : ""}
      </p>
    </div>
  );
}

/**
 * En bikefit som rapport: resultatet, vinklarna, videon, cykelns mått mot
 * förra fiten, checklistan och vad mätningen inte kan se.
 */
export function FitReport({
  fit,
  previous,
  media,
}: {
  fit: BikeFitRow;
  previous: BikeFitRow | null;
  media: { video: string | null; frame: string | null };
}) {
  const template = TEMPLATES[fit.discipline];
  const a = assessmentOf(fit);
  const legsText =
    a.legSource === "standard"
      ? "standardben (lår 430 mm, underben 440 mm) – ange egna mått för en exaktare siffra"
      : `${a.legSource === "video" ? "benlängder ur videon" : "coachens benlängder"}: lår ${fit.legs.thighMm} mm, underben ${fit.legs.shankMm} mm`;
  const analysis = fit.analysis;

  return (
    <div className="space-y-6">
      <Card level="lead" className="min-w-0">
        <CardTitle>Resultat</CardTitle>
        <p className="max-w-3xl text-[17px] font-semibold leading-snug text-text">
          {a.sentence}
        </p>
        <p className="mt-2 text-[13px] text-text-muted">
          {DISCIPLINE_LABEL[fit.discipline]}
          {fit.bike ? ` · ${fit.bike}` : ""} · {longDate(fit.performed_on)} ·{" "}
          {fit.method === "video" ? "mätt ur video" : "mätt manuellt"}
          {a.mmPerDegree !== null &&
            ` · ${sv(a.mmPerDegree)} mm sadelhöjd per grad, ${legsText}`}
        </p>
      </Card>

      <section aria-labelledby="vinklar" className="min-w-0">
        <h2 id="vinklar" className="sr-only">
          Vinklarna
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <AngleTile
            title="Knä i nedre dödläget"
            a={a.knee}
            manual={fit.method === "manuell"}
            previous={previous?.angles.knee}
          />
          <AngleTile
            title="Bål mot vågrätt"
            a={a.trunk}
            manual={fit.method === "manuell"}
            previous={previous?.angles.trunk}
          />
          <AngleTile
            title="Armbåge"
            a={a.elbow}
            manual={fit.method === "manuell"}
            previous={previous?.angles.elbow}
          />
          <AngleTile
            title="Axel"
            a={a.shoulder}
            manual={fit.method === "manuell"}
            previous={previous?.angles.shoulder}
          />
          <AngleTile
            title="Höft vid nedre dödläget"
            a={a.hip}
            manual={fit.method === "manuell"}
            previous={previous?.angles.hip}
          />
        </div>
        <p className="mt-2 max-w-3xl text-[12px] text-text-subtle">
          Knäböjningen är 180° minus vinkeln höft–knä–fotled. Grönt i bandet,
          gult inom ±{sv(TOLERANCE)}° (ett mobilvideo löser upp ungefär två till
          tre grader) och rött utanför – bara rött ger ett förslag att flytta
          sadeln. Bål och armbåge jämförs med erfarenhetsvärden ur praktiken,
          inte med en belagd norm. Axel och höft mäts men bedöms inte: studier
          och bike-fit-guider definierar ledpunkten olika.
        </p>
      </section>

      {(media.video || media.frame) && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {media.video && (
            <Card className="min-w-0">
              <CardTitle>Analysvideo</CardTitle>
              <video
                src={media.video}
                controls
                playsInline
                preload="metadata"
                className="max-h-[70vh] w-full rounded-md bg-black"
              />
            </Card>
          )}
          {media.frame && (
            <Card className="min-w-0">
              <CardTitle>Nedre dödläget</CardTitle>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media.frame}
                alt="Bilden från nedre dödläget med skelett och vinklar"
                className="w-full rounded-md"
              />
            </Card>
          )}
        </div>
      )}

      {analysis && (
        <Card className="min-w-0">
          <CardTitle>Videoanalysen</CardTitle>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-4">
            {[
              ["Bildfrekvens", `${sv(analysis.fps, 0)} B/s`],
              ["Längd", `${sv(analysis.durationS)} s`],
              [
                "Kadens",
                analysis.cadenceRpm ? `${sv(analysis.cadenceRpm, 0)} rpm` : "–",
              ],
              ["Varv mätta", `${analysis.bdc.length}`],
              [
                "Spridning mellan varven",
                analysis.kneeSpread !== null
                  ? `${sv(analysis.kneeSpread)}°`
                  : "–",
              ],
              [
                "Sida",
                analysis.side === "left"
                  ? "vänster"
                  : analysis.side === "right"
                    ? "höger"
                    : "–",
              ],
              [
                "Sidovy",
                analysis.sideRatio !== null
                  ? `${Math.round(analysis.sideRatio * 100)} % (högst 25)`
                  : "ren",
              ],
              ["Modell", analysis.model],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-text-muted">{k}</dt>
                <dd className="truncate text-text tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          {analysis.problems.length > 0 && (
            <ul className="mt-3 space-y-1 text-[13px] text-text">
              {analysis.problems.map((p) => (
                <li key={p} className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warn"
                  />
                  {p}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardTitle>Cykelns mått</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[20rem] text-[13px] tabular-nums">
              <thead>
                <tr className="text-left text-text-muted">
                  <th scope="col" className="py-1 pr-3 font-normal">
                    Mått
                  </th>
                  <th scope="col" className="py-1 pr-3 text-right font-normal">
                    Nu
                  </th>
                  {previous && (
                    <th scope="col" className="py-1 text-right font-normal">
                      {longDate(previous.performed_on)}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {template.measures.map((m) => {
                  const now = fit.measures[m.key];
                  const then = previous?.measures[m.key];
                  if (
                    (now === undefined || now === null) &&
                    (then === undefined || then === null)
                  )
                    return null;
                  const show = (v: string | number | null | undefined) =>
                    v === null || v === undefined
                      ? "–"
                      : typeof v === "number"
                        ? `${sv(v, m.unit === "°" ? 1 : 0)}${m.unit === "text" ? "" : ` ${m.unit}`}`
                        : v;
                  const changed =
                    previous &&
                    typeof now === "number" &&
                    typeof then === "number" &&
                    now !== then;
                  return (
                    <tr key={m.key} className="border-t border-line">
                      <th
                        scope="row"
                        className="py-1.5 pr-3 text-left font-normal text-text-muted"
                      >
                        {m.label}
                      </th>
                      <td className="py-1.5 pr-3 text-right text-text">
                        {show(now)}
                        {changed && (
                          <span className="ml-1.5 text-[12px] text-text-subtle">
                            ({(now as number) > (then as number) ? "+" : ""}
                            {sv((now as number) - (then as number), 0)})
                          </span>
                        )}
                      </td>
                      {previous && (
                        <td className="py-1.5 text-right text-text-muted">
                          {show(then)}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {Object.keys(fit.measures).length === 0 && (
            <p className="text-sm text-text-muted">Inga mått ifyllda.</p>
          )}
        </Card>

        <Card className="min-w-0">
          <CardTitle>Coachens anteckningar</CardTitle>
          <ul className="space-y-1.5 text-[13px]">
            {template.checklist.map((item) => (
              <li key={item} className="flex gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 shrink-0",
                    fit.checklist[item] ? "text-good" : "text-text-subtle",
                  )}
                >
                  {fit.checklist[item] ? "✓" : "–"}
                </span>
                <span
                  className={
                    fit.checklist[item] ? "text-text" : "text-text-muted"
                  }
                >
                  {item}
                  <span className="sr-only">
                    {fit.checklist[item] ? " (ok)" : " (inte bockad)"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {fit.changes && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-[12px] font-medium text-text-muted">
                Ändrat vid den här fiten
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-text">
                {fit.changes}
              </p>
            </div>
          )}
          {fit.notes && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-[12px] font-medium text-text-muted">
                Anteckningar
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-text">
                {fit.notes}
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card level="flat" className="min-w-0">
        <p className="max-w-3xl text-[13px] leading-relaxed text-text-muted">
          <span className="font-medium text-text">Vad mätningen inte ser.</span>{" "}
          En video från sidan kan bedöma sadelhöjd och överkroppens hållning.
          Den ser inte om knäna vandrar inåt eller utåt, och den säger inget om
          klossarnas läge – det kräver en inspelning framifrån. Gör det ont att
          cykla ersätter det här inte en människa som tittar på dig. Ändra en
          sak i taget och filma igen: den som flyttar sadelhöjd och sittläge
          samtidigt vet inte efteråt vad som gjorde skillnad.
        </p>
      </Card>
    </div>
  );
}
