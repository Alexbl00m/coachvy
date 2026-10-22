import { Card, CardTitle } from "@/components/ui/card";
import {
  AREAS,
  BODY,
  INTAKE,
  SCREENING,
  sideDifference,
} from "@/lib/bikefit/protocol";
import {
  MEASURE_GROUPS,
  TEMPLATES,
  type BikeMeasure,
  type MeasureGroup,
} from "@/lib/bikefit/templates";
import { longDate } from "@/lib/season/season";
import type { BikeFitRow } from "@/lib/types/database";

const sv = (v: number, d = 0) =>
  v.toFixed(d).replace(".", ",").replace("-", "−");
const signed = (v: number, d = 0) => `${v > 0 ? "+" : ""}${sv(v, d)}`;
type MeasureValue = string | number | null | undefined;

const show = (m: BikeMeasure, v: MeasureValue) =>
  v === null || v === undefined || v === ""
    ? "–"
    : typeof v === "number"
      ? `${sv(v, m.unit === "°" ? 1 : 0)}${m.unit === "text" ? "" : ` ${m.unit}`}`
      : v;

/** Samtalet före fiten, när något fördes in. */
export function IntakeReport({ fit }: { fit: BikeFitRow }) {
  const rows = INTAKE.filter((f) => fit.intake[f.key]);
  if (rows.length === 0) return null;
  return (
    <Card className="min-w-0">
      <CardTitle>Samtalet</CardTitle>
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {rows.map((f) => (
          <div key={f.key} className="min-w-0">
            <dt className="text-[12px] font-medium text-text-muted">
              {f.label}
            </dt>
            <dd className="mt-0.5 whitespace-pre-line text-sm text-text">
              {fit.intake[f.key]}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/**
 * Cykelns mått före och efter fiten, och mot förra fitens slutläge. En
 * ändring syns med sin skillnad; det oförändrade står kvar för helheten.
 */
export function MeasuresReport({
  fit,
  previous,
}: {
  fit: BikeFitRow;
  previous: BikeFitRow | null;
}) {
  const template = TEMPLATES[fit.discipline];
  const before = fit.measures_before ?? {};
  const hasBefore = Object.keys(before).length > 0;
  const present = (v: MeasureValue) =>
    v !== null && v !== undefined && v !== "";
  const groups = (Object.keys(MEASURE_GROUPS) as MeasureGroup[])
    .map((g) => ({
      g,
      items: template.measures.filter(
        (m) =>
          m.group === g &&
          (present(fit.measures[m.key]) ||
            present(before[m.key]) ||
            present(previous?.measures[m.key])),
      ),
    }))
    .filter((x) => x.items.length > 0);
  const changed = template.measures.filter(
    (m) =>
      hasBefore &&
      present(fit.measures[m.key]) &&
      fit.measures[m.key] !== before[m.key],
  );

  return (
    <Card className="min-w-0">
      <CardTitle>Cykelns mått</CardTitle>
      {groups.length === 0 ? (
        <p className="text-sm text-text-muted">Inga mått ifyllda.</p>
      ) : (
        <>
          {hasBefore && (
            <p className="mb-3 text-[13px] text-text-muted">
              {changed.length === 0
                ? "Inga mått ändrades vid fiten."
                : `${changed.length} ${changed.length === 1 ? "mått ändrades" : "mått ändrades"} vid fiten: ${changed.map((m) => m.label.toLowerCase()).join(", ")}.`}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[26rem] text-[13px] tabular-nums">
              <thead>
                <tr className="text-left text-text-muted">
                  <th scope="col" className="py-1 pr-3 font-normal">
                    Mått
                  </th>
                  {hasBefore && (
                    <th
                      scope="col"
                      className="py-1 pr-3 text-right font-normal"
                    >
                      Före
                    </th>
                  )}
                  <th scope="col" className="py-1 pr-3 text-right font-normal">
                    {hasBefore ? "Efter" : "Nu"}
                  </th>
                  {previous && (
                    <th scope="col" className="py-1 text-right font-normal">
                      Förra fiten, {longDate(previous.performed_on)}
                    </th>
                  )}
                </tr>
              </thead>
              {groups.map(({ g, items }) => (
                <tbody key={g}>
                  <tr>
                    <th
                      scope="rowgroup"
                      colSpan={4}
                      className="pt-3 pb-1 text-left text-[12px] font-semibold text-text"
                    >
                      {MEASURE_GROUPS[g]}
                    </th>
                  </tr>
                  {items.map((m) => {
                    const now = fit.measures[m.key];
                    const was = before[m.key];
                    const diff =
                      hasBefore &&
                      typeof now === "number" &&
                      typeof was === "number" &&
                      now !== was
                        ? now - was
                        : null;
                    const textChanged =
                      hasBefore &&
                      typeof now === "string" &&
                      present(was) &&
                      now !== was;
                    return (
                      <tr key={m.key} className="border-t border-line">
                        <th
                          scope="row"
                          className="py-1.5 pr-3 text-left font-normal text-text-muted"
                        >
                          {m.label}
                        </th>
                        {hasBefore && (
                          <td className="py-1.5 pr-3 text-right text-text-muted">
                            {show(m, was)}
                          </td>
                        )}
                        <td
                          className={`py-1.5 pr-3 text-right ${diff !== null || textChanged ? "font-medium text-text" : "text-text"}`}
                        >
                          {show(m, now)}
                          {diff !== null && (
                            <span className="ml-1.5 text-[12px] font-normal text-text-subtle">
                              ({signed(diff, m.unit === "°" ? 1 : 0)})
                            </span>
                          )}
                        </td>
                        {previous && (
                          <td className="py-1.5 text-right text-text-muted">
                            {show(m, previous.measures[m.key])}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

/** Kroppens mått, med skillnaden mellan sidorna där båda är mätta. */
export function BodyReport({ fit }: { fit: BikeFitRow }) {
  const body = fit.body ?? {};
  const rows = BODY.filter((m) =>
    m.sides ? body[`${m.key}_l`] || body[`${m.key}_r`] : body[m.key],
  );
  if (rows.length === 0) return null;
  return (
    <Card className="min-w-0">
      <CardTitle>Kroppen</CardTitle>
      <table className="w-full text-[13px] tabular-nums">
        <thead>
          <tr className="text-left text-text-muted">
            <th scope="col" className="py-1 pr-3 font-normal">
              Mått
            </th>
            <th scope="col" className="py-1 pr-3 text-right font-normal">
              Vänster
            </th>
            <th scope="col" className="py-1 pr-3 text-right font-normal">
              Höger
            </th>
            <th scope="col" className="py-1 text-right font-normal">
              Skillnad
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const diff = m.sides ? sideDifference(body, m.key) : null;
            const v = (k: string) =>
              body[k]
                ? `${sv(body[k], m.unit === "kg" ? 1 : 0)} ${m.unit}`
                : "–";
            return (
              <tr key={m.key} className="border-t border-line">
                <th
                  scope="row"
                  className="py-1.5 pr-3 text-left font-normal text-text-muted"
                >
                  {m.label}
                </th>
                {m.sides ? (
                  <>
                    <td className="py-1.5 pr-3 text-right text-text">
                      {v(`${m.key}_l`)}
                    </td>
                    <td className="py-1.5 pr-3 text-right text-text">
                      {v(`${m.key}_r`)}
                    </td>
                    <td className="py-1.5 text-right text-text-muted">
                      {diff === null ? "–" : `${signed(diff)} ${m.unit}`}
                    </td>
                  </>
                ) : (
                  <td colSpan={3} className="py-1.5 text-right text-text">
                    {v(m.key)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

/** Funktionstesterna, med förra fitens värden där de finns. */
export function ScreeningReport({
  fit,
  previous,
}: {
  fit: BikeFitRow;
  previous: BikeFitRow | null;
}) {
  const tests = SCREENING.filter((t) => fit.screening?.[t.key]);
  if (tests.length === 0) return null;
  return (
    <Card className="min-w-0">
      <CardTitle>Funktionstester</CardTitle>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-[13px] tabular-nums">
          <thead>
            <tr className="text-left text-text-muted">
              <th scope="col" className="py-1 pr-3 font-normal">
                Test
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-normal">
                Vänster
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-normal">
                Höger
              </th>
              <th scope="col" className="py-1 font-normal">
                Kommentar
              </th>
            </tr>
          </thead>
          <tbody>
            {tests.map((t) => {
              const v = fit.screening[t.key];
              const p = previous?.screening?.[t.key];
              const cell = (k: "l" | "r" | "value") => {
                const x = v[k];
                if (x === undefined) return "–";
                const was = p?.[k];
                return (
                  <>
                    {sv(x, Number.isInteger(x) ? 0 : 1)}
                    {t.unit === "°" ? "°" : ` ${t.unit}`}
                    {was !== undefined && was !== x && (
                      <span className="ml-1 text-[12px] text-text-subtle">
                        ({signed(x - was, Number.isInteger(x - was) ? 0 : 1)})
                      </span>
                    )}
                  </>
                );
              };
              return (
                <tr key={t.key} className="border-t border-line align-top">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                    <span className="block text-text">{t.label}</span>
                    <span className="block text-[11px] text-text-subtle">
                      {t.about}
                    </span>
                  </th>
                  {t.sides ? (
                    <>
                      <td className="py-1.5 pr-3 text-right text-text">
                        {t.unit ? cell("l") : ""}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-text">
                        {t.unit ? cell("r") : ""}
                      </td>
                    </>
                  ) : (
                    <td
                      colSpan={2}
                      className="py-1.5 pr-3 text-right text-text"
                    >
                      {t.unit ? cell("value") : ""}
                    </td>
                  )}
                  <td className="py-1.5 text-text">{v.note ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {previous && (
        <p className="mt-2 text-[12px] text-text-subtle">
          Inom parentes: skillnaden mot fiten {longDate(previous.performed_on)}.
        </p>
      )}
    </Card>
  );
}

/** Fynd och åtgärder per område på cykeln. */
export function FindingsReport({ fit }: { fit: BikeFitRow }) {
  const areas = AREAS.filter((a) => fit.findings?.[a.key]);
  if (areas.length === 0) return null;
  return (
    <Card className="min-w-0">
      <CardTitle>På cykeln</CardTitle>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {areas.map((a) => (
          <section key={a.key} className="min-w-0">
            <h3 className="text-[13px] font-semibold text-text">{a.label}</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-text">
              {fit.findings[a.key]}
            </p>
          </section>
        ))}
      </div>
    </Card>
  );
}
