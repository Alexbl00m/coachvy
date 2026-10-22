import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { assessmentOf } from "@/components/bikefit/fit-report";
import { VERDICT_TEXT } from "@/components/bikefit/verdict-style";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { DISCIPLINE_LABEL, previousFit } from "@/lib/bikefit/fit";
import { listFits } from "@/lib/bikefit/queries";
import { DISCIPLINES } from "@/lib/bikefit/templates";
import { routes } from "@/lib/routes";
import { longDate } from "@/lib/season/season";

export const metadata = { title: "Bikefit" };

const sv = (v: number) => v.toFixed(1).replace(".", ",").replace("-", "−");

export default async function AdeptBikefitPage({
  params,
}: PageProps<"/app/adepter/[id]/tester/bikefit">) {
  const { adept, canEdit } = await loadWorkspace(params);
  const fits = await listFits(adept.id);
  const base = `${routes.adepts}/${adept.id}/bikefit`;
  const groups = DISCIPLINES.map((d) => ({
    discipline: d,
    fits: fits.filter((f) => f.discipline === d),
  })).filter((g) => g.fits.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-text-muted">
          {canEdit
            ? "Sittpositionen mätt ur video eller för hand, med mallar för landsväg, gravel, tempo och mountainbike. Varje fit jämförs med den förra i samma gren, så att det syns vad en ändring gav. Adepten ser en fit när du delar den."
            : "Bikefits som din coach har delat med dig, nyast först."}
        </p>
        {canEdit && <ButtonLink href={`${base}/ny`}>Ny bikefit</ButtonLink>}
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title={canEdit ? "Ingen bikefit ännu" : "Inga delade bikefits"}
          description={
            canEdit
              ? "Filma adepten från sidan på trainern i 15–30 sekunder, eller för in vinklarna du mätt själv."
              : "När din coach delar en bikefit hamnar den här."
          }
        />
      ) : (
        groups.map((g) => (
          <Card key={g.discipline} className="min-w-0">
            <CardTitle>{DISCIPLINE_LABEL[g.discipline]}</CardTitle>
            <ul className="-mx-2">
              {g.fits.map((fit) => {
                const a = assessmentOf(fit);
                const prev = previousFit(fits, fit);
                const knee = fit.angles.knee;
                const change =
                  knee != null && prev?.angles.knee != null
                    ? knee - prev.angles.knee
                    : null;
                return (
                  <li key={fit.id}>
                    <Link
                      href={`${base}/${fit.id}`}
                      className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-surface-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                          <span className="font-medium text-text">
                            {longDate(fit.performed_on)}
                          </span>
                          {fit.bike && (
                            <span className="text-text-muted">{fit.bike}</span>
                          )}
                          <span className="text-[12px] text-text-subtle">
                            {fit.method === "video" ? "video" : "manuell"}
                          </span>
                          {canEdit && (
                            <span className="text-[12px] text-text-subtle">
                              {fit.shared_at ? "delad" : "inte delad"}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-[13px] text-text-muted">
                          {a.sentence}
                        </p>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        <p className="text-sm text-text">
                          Knä {knee == null ? "–" : `${sv(knee)}°`}
                        </p>
                        <p className="text-[12px]">
                          <span
                            className={
                              a.knee.verdict
                                ? VERDICT_TEXT[a.knee.verdict]
                                : "text-text-subtle"
                            }
                          >
                            {a.knee.label}
                          </span>
                          {change !== null && Math.abs(change) >= 0.1 && (
                            <span className="text-text-subtle">
                              {" "}
                              · {change > 0 ? "+" : ""}
                              {sv(change)}°
                            </span>
                          )}
                        </p>
                      </div>
                      <ChevronRight
                        aria-hidden
                        className="size-4 shrink-0 text-text-subtle"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
