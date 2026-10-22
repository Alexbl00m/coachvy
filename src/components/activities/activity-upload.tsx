"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { saveActivity, saveMultisport } from "@/lib/activities/actions";
import { formatClock } from "@/lib/activities/analysis";
import {
  parseFit,
  prepareParsed,
  SPORT_NAME,
  type PreparedActivity,
} from "@/lib/activities/prepare";
import type { ReferenceCandidate } from "@/lib/activities/reference";
import {
  KIND_NAME,
  legName,
  type MultisportSummary,
} from "@/lib/activities/multisport";
import { routes } from "@/lib/routes";

import { MultisportStrip } from "./multisport-strip";

export type RaceChoice = { id: string; name: string; race_date: string };

/** Ett pass, eller grenarna i ett multisportlopp med loppets delar. */
type Ready = PreparedActivity & {
  legs: PreparedActivity[];
  multisport: MultisportSummary | null;
};

const km = (m: number | null) =>
  m === null ? "–" : `${(m / 1000).toFixed(1).replace(".", ",")} km`;

/**
 * Laddar upp ett genomfört pass eller lopp ur klockans .fit-fil.
 *
 * Filen läses och analyseras här i webbläsaren. Det som sparas är analysen och
 * en nedsamplad serie för kartan och graferna, med de tröskelvärden analysen
 * räknades mot – aldrig själva filen.
 */
export function ActivityUpload({
  adeptId,
  candidates,
  races,
}: {
  adeptId: string;
  candidates: ReferenceCandidate[];
  races: RaceChoice[];
}) {
  const router = useRouter();
  const inputId = useId();
  const nameId = useId();
  const raceId = useId();
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<string | null>(null);
  const [ready, setReady] = useState<Ready | null>(null);
  const [name, setName] = useState("");
  const [race, setRace] = useState("");
  const [isRace, setIsRace] = useState(false);
  const [saving, startSaving] = useTransition();

  const read = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setError(null);
    setExisting(null);
    setReady(null);
    try {
      const fileData = await parseFit(await file.arrayBuffer());
      const legs = fileData.legs.map((leg) => prepareParsed(leg, candidates));
      const prepared = legs[0];
      const { parsed, date } = prepared;
      const sameDay = races.find((r) => r.race_date === date);
      const multi = fileData.multisport;
      setRace(sameDay?.id ?? "");
      setIsRace(Boolean(sameDay));
      setName(
        sameDay?.name ??
          (multi
            ? `${KIND_NAME[multi.kind]} ${date}`
            : `${SPORT_NAME[parsed.sport]} ${date}`),
      );
      setReady({ ...prepared, legs, multisport: multi });
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes("för lite")
          ? e.message
          : "Filen gick inte att läsa. Är det en .fit-fil från klockan eller cykeldatorn?",
      );
    } finally {
      setReading(false);
    }
  };

  const save = () => {
    if (!ready) return;
    const multi = ready.multisport;
    if (multi) {
      startSaving(async () => {
        const result = await saveMultisport(
          adeptId,
          ready.legs.map((leg, i) => ({
            adeptId,
            name: legName(name.trim(), leg.parsed.sport),
            sport: leg.parsed.sport,
            startedAt: leg.parsed.startedAt,
            device: leg.parsed.device,
            raceId: isRace ? race || null : null,
            isRace,
            summary: leg.summary,
            reference: leg.reference,
            streams: leg.streams,
            laps: leg.parsed.laps,
            multisport: { ...multi, leg: i },
          })),
        );
        if (result.ok) {
          router.push(`${routes.adepts}/${adeptId}/aktivitet/${result.id}`);
          return;
        }
        setError(result.error);
        setExisting(result.existingId ?? null);
      });
      return;
    }
    startSaving(async () => {
      const result = await saveActivity({
        adeptId,
        name,
        sport: ready.parsed.sport,
        startedAt: ready.parsed.startedAt,
        device: ready.parsed.device,
        raceId: isRace ? race || null : null,
        isRace,
        summary: ready.summary,
        reference: ready.reference,
        streams: ready.streams,
        laps: ready.parsed.laps,
      });
      if (result.ok) {
        router.push(`${routes.adepts}/${adeptId}/aktivitet/${result.id}`);
        return;
      }
      setError(result.error);
      setExisting(result.existingId ?? null);
    });
  };

  const s = ready?.summary;
  const ref = ready?.reference;

  return (
    <div className="space-y-4">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void read(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-dashed px-4 py-4 text-sm transition-colors",
          dragging
            ? "border-accent bg-accent-soft"
            : "border-line-strong hover:border-accent/60",
        )}
      >
        <FileUp aria-hidden className="size-5 shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1">
          <span className="font-medium text-text">
            {reading
              ? "Läser och analyserar filen …"
              : "Ladda upp ett pass eller lopp"}
          </span>
          <span className="block text-[0.75rem] text-text-subtle">
            Välj eller släpp en .fit-fil från Garmin, Wahoo, Coros, Hammerhead
            eller TrainingPeaks. Analysen görs här i webbläsaren; filen sparas
            inte, bara analysen och kurvorna.
          </span>
        </span>
        <input
          id={inputId}
          type="file"
          accept=".fit,.FIT"
          className="sr-only"
          onChange={(e) => {
            void read(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-text-muted">
          {error}{" "}
          {existing && (
            <a
              href={`${routes.adepts}/${adeptId}/aktivitet/${existing}`}
              className="font-medium text-text underline decoration-line-strong underline-offset-2 hover:decoration-text"
            >
              Öppna den
            </a>
          )}
        </p>
      )}

      {ready && s && ref && (
        <div className="enter space-y-4 rounded-lg border border-line p-4">
          {ready.multisport && (
            <div className="space-y-2">
              <p className="text-sm text-text">
                <span className="font-medium">
                  {KIND_NAME[ready.multisport.kind]}
                </span>{" "}
                · {formatClock(ready.multisport.totalS)} ·{" "}
                {km(ready.multisport.distanceM)}
                <span className="block text-[0.75rem] text-text-subtle">
                  Filen har flera grenar. Varje gren sparas som en egen
                  aktivitet med sin egen analys, och växlingarna som tider. Ett
                  pass som redan finns i samma gren – cykeldatorns – blir
                  grenen i stället för klockans inspelning.
                </span>
              </p>
              <MultisportStrip parts={ready.multisport.parts} />
            </div>
          )}
          <dl
            className={cn(
              "grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4",
              ready.multisport && "hidden",
            )}
          >
            {[
              ["Datum", ready.date],
              ["Tid", formatClock(s.elapsedS)],
              ["Distans", km(s.distanceM)],
              [
                ready.parsed.sport === "cykling" ? "NP" : "Snittfart",
                ready.parsed.sport === "cykling" && s.normalizedPower
                  ? `${Math.round(s.normalizedPower)} W`
                  : s.avgSpeed
                    ? `${s.avgSpeed.toFixed(1).replace(".", ",")} km/h`
                    : "–",
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[0.6875rem] uppercase tracking-[0.08em] text-text-subtle">
                  {label}
                </dt>
                <dd className="font-medium text-text tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <p className="text-[0.75rem] text-text-subtle">
            {ref.testedOn || ref.ftpSource
              ? `Räknas mot ${[
                  ref.ftp ? `FTP ${Math.round(ref.ftp)} W` : null,
                  ref.cp ? `CP ${Math.round(ref.cp)} W` : null,
                  ref.cs
                    ? `CS ${(ref.cs * 3.6).toFixed(1).replace(".", ",")} km/h`
                    : null,
                  ref.lthr ? `tröskelpuls ${Math.round(ref.lthr)}` : null,
                ]
                  .filter(Boolean)
                  .join(
                    ", ",
                  )}${ref.testedOn ? ` – testet närmast före, ${ref.testedOn}` : ` – ${ref.ftpSource}`}.`
              : "Inga testvärden att räkna mot ännu – analysen visar tid, fart, effekt och puls, men inte zoner eller W′."}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Namn" htmlFor={nameId}>
              <Input
                id={nameId}
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <div className="space-y-3">
              <Switch
                checked={isRace}
                onChange={setIsRace}
                label="Tävling"
                hint="Ett lopp eller en tävling, planerad eller inte."
              />
              {isRace && (
                <Field label="Planerad tävling" htmlFor={raceId} optional>
                  <Select
                    id={raceId}
                    value={race}
                    onChange={(e) => setRace(e.target.value)}
                  >
                    <option value="">Oplanerad – inte i säsongsplanen</option>
                    {races.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} · {r.race_date}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving || !name.trim()}>
              {saving
                ? "Sparar …"
                : ready.multisport
                  ? `Spara ${ready.legs.length} grenar`
                  : "Spara och visa analysen"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setReady(null)}
              disabled={saving}
            >
              Avbryt
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
