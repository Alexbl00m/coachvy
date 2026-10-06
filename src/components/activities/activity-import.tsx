"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { Archive } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import {
  finishImport,
  importActivities,
  type SaveActivityInput,
} from "@/lib/activities/actions";
import { scanFiles, type ArchiveScan } from "@/lib/activities/archive";
import {
  IMPORT_BATCH,
  IMPORT_POINTS,
  parseFit,
  prepareParsed,
  SPORT_NAME,
} from "@/lib/activities/prepare";
import type { ReferenceCandidate } from "@/lib/activities/reference";
import { cn } from "@/lib/cn";

type Tally = {
  done: number;
  saved: number;
  duplicates: number;
  /** Filer som inte gick att läsa, eller var för korta för en analys. */
  unreadable: number;
};

const EMPTY: Tally = { done: 0, saved: 0, duplicates: 0, unreadable: 0 };

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** Var exporten finns hos de vanliga tjänsterna. */
function WhereToFind() {
  return (
    <details className="group mt-3 text-[13px] text-text-muted">
      <summary className="cursor-pointer text-accent-text hover:text-accent-hover">
        Var hittar man filerna?
      </summary>
      <ul className="mt-2 space-y-2 leading-relaxed">
        <li>
          <span className="text-text">Garmin:</span> logga in på
          garmin.com/account → Datahantering (Data Management) → Exportera dina
          data. Garmin mejlar en länk till en zip, oftast inom ett dygn. Släpp
          hela zip-filen här – passen ligger i en zip inuti den.
        </li>
        <li>
          <span className="text-text">TrainingPeaks:</span> Inställningar →
          Exportera data → Passfiler, för ett datumspann. Zip-filen med
          .fit.gz-filer kan släppas här direkt.
        </li>
        <li>
          <span className="text-text">Strava:</span> Inställningar → Mitt konto
          → Ladda ner eller radera ditt konto → Begär arkiv. Strava mejlar en
          zip; passen i den som .fit eller .fit.gz läses, GPX och TCX hoppas
          över.
        </li>
      </ul>
    </details>
  );
}

/**
 * Importerar en hel historik: en export från Garmin, TrainingPeaks eller
 * Strava, eller många FIT-filer på en gång. Varje pass läses och analyseras
 * här i webbläsaren, ett i taget, och sparas med en glesare serie än ett pass
 * som laddas upp för sig. Filerna lämnar aldrig datorn.
 */
export function ActivityImport({
  adeptId,
  adeptName,
  candidates,
  existingStarts,
  allowed,
}: {
  adeptId: string;
  adeptName: string;
  candidates: ReferenceCandidate[];
  /** Starttiderna för passen som redan finns, för att hoppa över dem tidigt. */
  existingStarts: string[];
  /** Adepten har godkänt behandlingen av hälsouppgifter. */
  allowed: boolean;
}) {
  const router = useRouter();
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const [scan, setScan] = useState<ArchiveScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [tally, setTally] = useState<Tally>(EMPTY);
  const [current, setCurrent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  const firstName = adeptName.split(" ")[0] || adeptName;

  if (!allowed) {
    return (
      <Card>
        <CardTitle>Importera historik</CardTitle>
        <p className="text-sm text-text-muted">
          En historik är år av puls- och GPS-data. Den kan importeras när{" "}
          {firstName} har godkänt att hälsouppgifter behandlas – enskilda lopp
          och pass går att ladda upp ovan som vanligt.
        </p>
      </Card>
    );
  }

  const choose = async (files: File[]) => {
    if (files.length === 0 || running) return;
    setScanning(true);
    setError(null);
    setFinished(false);
    setTally(EMPTY);
    try {
      const found = await scanFiles(files);
      setScan(found);
      if (found.fit.length === 0) {
        setError(
          found.errors[0] ??
            "Inga FIT-filer hittades. Exporten ska innehålla .fit- eller .fit.gz-filer.",
        );
      }
    } finally {
      setScanning(false);
    }
  };

  const run = async () => {
    if (!scan || scan.fit.length === 0) return;
    cancelled.current = false;
    setRunning(true);
    setFinished(false);
    setError(null);
    const known = new Set(existingStarts.map((s) => Date.parse(s)));
    const t: Tally = { ...EMPTY };
    let batch: SaveActivityInput[] = [];

    const flush = async () => {
      if (batch.length === 0) return true;
      const result = await importActivities(adeptId, batch);
      batch = [];
      if (!result.ok) {
        setError(result.error ?? "Passen kunde inte sparas.");
        return false;
      }
      t.saved += result.saved;
      t.duplicates += result.duplicates;
      t.unreadable += result.failed;
      setTally({ ...t });
      return true;
    };

    for (const entry of scan.fit) {
      if (cancelled.current) break;
      setCurrent(entry.name.split("/").pop() ?? entry.name);
      try {
        const parsed = await parseFit(await entry.read());
        const start = Date.parse(parsed.startedAt);
        if (known.has(start)) {
          t.duplicates += 1;
        } else {
          known.add(start);
          const p = prepareParsed(parsed, candidates, IMPORT_POINTS);
          batch.push({
            adeptId,
            name: `${SPORT_NAME[parsed.sport]} ${p.date}`,
            sport: parsed.sport,
            startedAt: parsed.startedAt,
            device: parsed.device,
            raceId: null,
            summary: { ...p.summary, imported: true },
            reference: p.reference,
            streams: p.streams,
            laps: [],
          });
        }
      } catch {
        t.unreadable += 1;
      }
      t.done += 1;
      setTally({ ...t });
      if (batch.length >= IMPORT_BATCH && !(await flush())) break;
      // Låt sidan rita om mellan filerna.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await flush();
    setCurrent(null);
    setRunning(false);
    setFinished(true);
    await finishImport(adeptId);
    router.refresh();
  };

  const total = scan?.fit.length ?? 0;
  const pct = total > 0 ? Math.round((tally.done / total) * 100) : 0;

  return (
    <Card>
      <CardTitle>Importera historik</CardTitle>
      <p className="text-sm text-text-muted">
        Hela {firstName}s träning på en gång, för bästa-kurvor och profilen ur
        träningen. Släpp en export från Garmin, TrainingPeaks eller Strava,
        eller många FIT-filer. Allt läses här i webbläsaren och filerna sparas
        inte; pass som redan finns hoppas över.
      </p>
      <WhereToFind />

      {!running && (
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
            void choose(Array.from(e.dataTransfer.files));
          }}
          className={cn(
            "mt-4 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-4 text-sm transition-colors",
            dragging
              ? "border-accent bg-accent-soft"
              : "border-line-strong hover:border-text-subtle",
          )}
        >
          <Archive aria-hidden className="size-5 shrink-0 text-text-muted" />
          <span className="min-w-0 flex-1">
            <span className="font-medium text-text">
              {scanning
                ? "Letar efter pass i filerna …"
                : "Välj eller släpp zip-filen eller FIT-filerna"}
            </span>
            <span className="block text-[12px] text-text-subtle">
              .zip, .fit och .fit.gz – flera på en gång går bra.
            </span>
          </span>
          <input
            id={inputId}
            type="file"
            multiple
            accept=".zip,.fit,.gz,.FIT"
            className="sr-only"
            onChange={(e) => {
              void choose(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </label>
      )}

      {scan && total > 0 && !running && !finished && (
        <div className="enter mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button onClick={run}>
            Importera {plural(total, "pass", "pass")}
          </Button>
          <p className="text-[13px] text-text-subtle">
            {scan.skipped > 0 &&
              `${plural(scan.skipped, "annan fil", "andra filer")} hoppas över. `}
            Tar under en sekund per pass – låt sidan vara öppen tills det står
            klart.
          </p>
        </div>
      )}

      {(running || finished) && (
        <div className="mt-4" role="status" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-text tabular-nums">
              {finished ? "Klart." : `${tally.done} av ${total} · ${pct} %`}
            </span>
            {running && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  cancelled.current = true;
                }}
              >
                Avbryt
              </Button>
            )}
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-text-muted transition-[width] duration-200 ease-out"
              style={{ width: `${finished ? 100 : pct}%` }}
            />
          </div>
          <p className="mt-2 text-[13px] text-text-muted tabular-nums">
            {plural(tally.saved, "nytt pass", "nya pass")} · {tally.duplicates}{" "}
            fanns redan · {tally.unreadable} gick inte att läsa
          </p>
          {current && (
            <p className="mt-1 truncate font-mono text-[11px] text-text-subtle">
              {current}
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[13px] text-bad">
          {error}
        </p>
      )}
    </Card>
  );
}
