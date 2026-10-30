"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { endActivePhase, removeQueuedPhase } from "@/lib/plan-library/queue-actions";
import { adeptHref, routes } from "@/lib/routes";

import { PlanPicker, type PickerPlan, type PickerSuggestion } from "./plan-picker";

export type QueueItem = {
  id: string;
  title: string;
  status: "aktiv" | "kommande";
  startDate: string;
  /** Första dagen efter sista veckan. */
  endDate: string;
  weeks: number;
};

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Adeptens faser i ordning: den aktiva och de som står i kö. Coachen lägger
 * till en plan sist i kön med planväljaren, tar bort en kommande fas och
 * avslutar den pågående; faserna efter flyttas fram. Utan pågående fas står
 * förslaget ur testet och huvudloppet i kortet.
 */
export function PhaseQueue({
  adept,
  items,
  plans,
  suggestions,
  sportName,
  defaultStart,
  previousLevelKey,
  initial,
}: {
  adept: { id: string; firstName: string };
  items: QueueItem[];
  plans: PickerPlan[];
  suggestions: PickerSuggestion[];
  /** Adeptens gren i text, "löpning"; null när den saknas. */
  sportName: string | null;
  /** Förvald start när kön är tom: i dag om det är måndag, annars nästa måndag. */
  defaultStart: string;
  /** Nivån fasen före börjar på; en ny fas förväljs på samma nivå. */
  previousLevelKey: string | null;
  /** Väljaren öppen från adressen, med fokus eller en plan utpekad. */
  initial: { open: boolean; focus: string | null; versionId: string | null };
}) {
  const adeptId = adept.id;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(initial.open);
  const [fromUrl, setFromUrl] = useState(initial.open);

  const last = items.at(-1);
  const active = items.some((i) => i.status === "aktiv");
  const first = suggestions[0];

  // Väljaren öppnad från en länk: adressen städas när den stängs, så att
  // den inte öppnas igen när sidan laddas om.
  const closePicker = () => {
    setPicking(false);
    if (fromUrl) {
      setFromUrl(false);
      router.replace(pathname, { scroll: false });
    }
  };

  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Card className="mb-6">
      <CardTitle
        action={
          plans.length > 0 ? (
            <Button size="sm" variant="secondary" onClick={() => setPicking(true)}>
              <Plus aria-hidden className="size-4" />
              Lägg till fas
            </Button>
          ) : undefined
        }
      >
        Faser
      </CardTitle>

      {!active && first && (
        <div className="mb-4 rounded-md border border-line bg-surface-2 px-4 py-3">
          <p className="text-[0.75rem] font-medium text-text-subtle">
            Förslag ur testet och huvudloppet
          </p>
          <p className="mt-1 text-sm text-text-muted">
            <span className="font-medium text-text">{first.label}.</span> {first.reason}
          </p>
          <Button size="sm" className="mt-3 font-semibold" onClick={() => setPicking(true)}>
            Välj plan för {adept.firstName}
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-text-muted">
          Ingen plan igång. Lägg till den första fasen, en grundperiod i så
          många veckor du vill, och bygg på med nästa.
        </p>
      ) : (
        <ol className="divide-y divide-line rounded-md border border-line">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-text">{item.title}</span>
                <span className="text-[0.8125rem] text-text-muted">
                  {formatDate(item.startDate)} – {formatDate(addDays(item.endDate, -1))} ·{" "}
                  {item.weeks} veckor
                </span>
              </span>
              <span
                className={
                  item.status === "aktiv"
                    ? "text-[0.8125rem] font-medium text-accent-text"
                    : "text-[0.8125rem] text-text-subtle"
                }
              >
                {item.status === "aktiv" ? "Pågår" : "I kö"}
              </span>
              {item.status === "aktiv" && (
                <span className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem]">
                  <Link
                    href={adeptHref(adeptId, "bibliotek")}
                    className="font-medium text-accent-text hover:underline"
                  >
                    Veckoplanen
                  </Link>
                  <Link
                    href={`${routes.calendar}?adept=${adeptId}`}
                    className="font-medium text-accent-text hover:underline"
                  >
                    Se passen i kalendern
                  </Link>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const next = items.find((i) => i.status === "kommande");
                      const message = next
                        ? `Avsluta ${item.title} nu? ${next.title} flyttas fram och börjar i dag eller närmast efter, på samma veckodag.`
                        : `Avsluta ${item.title} nu? Planens pass försvinner ur kalendern.`;
                      if (!window.confirm(message)) return;
                      run(() => endActivePhase({ adeptId, instanceId: item.id }));
                    }}
                    className="ml-auto rounded-md px-2.5 py-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
                  >
                    Avsluta fasen
                  </button>
                </span>
              )}
              {item.status === "kommande" && (
                <button
                  type="button"
                  aria-label={`Ta bort ${item.title} ur kön`}
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Ta bort ${item.title} ur kön? Faserna efter flyttas fram.`)) return;
                    run(() => removeQueuedPhase({ adeptId, instanceId: item.id }));
                  }}
                  className="-my-1 rounded-full p-2 text-text-subtle hover:bg-surface-2 hover:text-text"
                >
                  <X aria-hidden className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-warn">
          {error}
        </p>
      )}

      <PlanPicker
        open={picking}
        onClose={closePicker}
        onAdded={() => {
          closePicker();
          router.refresh();
        }}
        adept={adept}
        plans={plans}
        suggestions={suggestions}
        sportName={sportName}
        fixedStart={last ? { start: last.endDate, after: last.title } : null}
        defaultStart={defaultStart}
        previousLevelKey={previousLevelKey}
        initialFocus={initial.focus}
        initialVersionId={initial.versionId}
      />
    </Card>
  );
}
