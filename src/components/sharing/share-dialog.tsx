"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { findCoach, saveShares } from "@/lib/sharing/actions";
import {
  choiceError,
  choiceOf,
  type Reach,
  type Share,
  type ShareChoice,
  type ShareKind,
} from "@/lib/sharing/shares";

const REACH: { key: Reach; label: string }[] = [
  { key: "inga", label: "Inga" },
  { key: "alla", label: "Alla" },
  { key: "utvalda", label: "Utvalda" },
];

/** Inga, alla eller utvalda, som en rad med tre knappar. */
function ReachPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Reach;
  onChange: (reach: Reach) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex w-fit rounded-md border border-line p-0.5"
    >
      {REACH.map((r) => (
        <button
          key={r.key}
          type="button"
          aria-pressed={value === r.key}
          onClick={() => onChange(r.key)}
          className={cn(
            "rounded-sm px-3 py-1 text-[0.8125rem] font-medium transition-colors",
            value === r.key
              ? "bg-surface-3 text-text"
              : "text-text-subtle hover:text-text",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

const REVIEW: Record<Share["status"], string> = {
  aktiv: "Godkänd. Medlemmarna ser det.",
  granskas: "Väntar på granskning. Medlemmarna ser det när Coachvy godkänt.",
  avslagen: "Inte godkänd.",
};

/**
 * Vem ser passet eller planen: ägarens adepter, alla medlemmar i Coachvy
 * och andra coacher, var för sig. Utan något val är det privat.
 */
export function ShareDialog({
  open,
  onClose,
  kind,
  itemId,
  title,
  shares,
  adepts,
  ownerIsAdmin,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  kind: ShareKind;
  itemId: string;
  title: string;
  shares: Share[];
  /** Ägarens adepter att välja bland. */
  adepts: { id: string; full_name: string }[];
  /** Admin delar med medlemmarna utan granskning. */
  ownerIsAdmin: boolean;
  onSaved?: (shares: Share[]) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<ShareChoice>(() => choiceOf(shares));
  // Namnen på utvalda coacher: de som redan finns och de som läggs till.
  const [coachNames, setCoachNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      shares
        .filter((s) => s.coachId)
        .map((s) => [s.coachId!, s.coachName ?? "Coach"]),
    ),
  );
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const thing = kind === "pass" ? "passet" : "planen";
  const it = kind === "pass" ? "det" : "den";
  const members = shares.find((s) => s.audience === "medlemmar");
  const patch = (next: Partial<ShareChoice>) => {
    setError(null);
    setChoice((c) => ({ ...c, ...next }));
  };

  const addCoach = () => {
    setError(null);
    startTransition(async () => {
      const found = await findCoach(email);
      if (!found.ok) {
        setError(found.error);
        return;
      }
      setCoachNames((n) => ({ ...n, [found.id]: found.name }));
      setChoice((c) => ({
        ...c,
        coaches: "utvalda",
        coachIds: [...new Set([...c.coachIds, found.id])],
      }));
      setEmail("");
    });
  };

  const save = () => {
    const invalid = choiceError(choice);
    if (invalid) {
      setError(invalid);
      return;
    }
    startTransition(async () => {
      const result = await saveShares({ kind, id: itemId, choice });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved?.(result.shares);
      router.refresh();
      onClose();
    });
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="dela-rubrik"
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-text shadow-2xl backdrop:bg-black/60"
    >
      <div className="space-y-6 p-5 sm:p-6">
        <div>
          <p className="text-[0.75rem] font-medium text-text-muted">
            Vem ser {thing}?
          </p>
          <h2 id="dela-rubrik" className="text-lg font-semibold">
            {title}
          </h2>
          <p className="mt-1 text-[0.8125rem] text-text-muted">
            Bara du ändrar {thing}. De du delar med använder {it}, och coacher
            kan kopiera {it} till sitt eget bibliotek.
          </p>
        </div>

        <section className="space-y-2.5">
          <h3 className="text-sm font-medium">Dina adepter</h3>
          {adepts.length === 0 ? (
            <p className="text-[0.8125rem] text-text-muted">
              Du har inga adepter än.
            </p>
          ) : (
            <>
              <ReachPicker
                label="Dina adepter"
                value={choice.adepts}
                onChange={(adepts) => patch({ adepts })}
              />
              {choice.adepts === "utvalda" && (
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-line p-2">
                  {adepts.map((a) => (
                    <li key={a.id}>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={choice.adeptIds.includes(a.id)}
                          onChange={(e) =>
                            patch({
                              adeptIds: e.target.checked
                                ? [...choice.adeptIds, a.id]
                                : choice.adeptIds.filter((id) => id !== a.id),
                            })
                          }
                          className="size-4 accent-[var(--accent)]"
                        />
                        {a.full_name}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[0.75rem] text-text-subtle">
                Dina adepter behöver inget medlemskap för det du delar med dem.
              </p>
            </>
          )}
        </section>

        <section className="space-y-2.5">
          <h3 className="text-sm font-medium">Medlemmar i Coachvy</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={choice.members}
              onChange={(e) => patch({ members: e.target.checked })}
              className="size-4 accent-[var(--accent)]"
            />
            Alla medlemmar
          </label>
          <p className="text-[0.75rem] text-text-subtle">
            {ownerIsAdmin
              ? "Syns direkt för alla medlemmar, med eller utan coach."
              : kind === "pass"
                ? "Coachvy granskar passet innan medlemmarna ser det. Ändrar du passet granskas det igen."
                : "Coachvy granskar planen innan medlemmarna ser den. En ny version granskas igen."}
          </p>
          {members && choice.members && !ownerIsAdmin && (
            <p
              className={cn(
                "text-[0.8125rem]",
                members.status === "avslagen" ? "text-warn" : "text-text-muted",
              )}
            >
              {REVIEW[members.status]}
              {members.reviewNote ? ` ${members.reviewNote}` : ""}
            </p>
          )}
        </section>

        <section className="space-y-2.5">
          <h3 className="text-sm font-medium">Coacher</h3>
          <ReachPicker
            label="Coacher"
            value={choice.coaches}
            onChange={(coaches) => patch({ coaches })}
          />
          {choice.coaches === "utvalda" && (
            <div className="space-y-2">
              {choice.coachIds.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {choice.coachIds.map((id) => (
                    <li
                      key={id}
                      className="flex items-center gap-1 rounded-full border border-line bg-surface-2 py-0.5 pr-1 pl-2.5 text-[0.8125rem]"
                    >
                      {coachNames[id] ?? "Coach"}
                      <button
                        type="button"
                        aria-label={`Ta bort ${coachNames[id] ?? "coachen"}`}
                        onClick={() =>
                          patch({
                            coachIds: choice.coachIds.filter((c) => c !== id),
                          })
                        }
                        className="rounded-full p-0.5 text-text-subtle hover:text-text"
                      >
                        <X aria-hidden className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <label htmlFor="dela-coach" className="sr-only">
                  Coachens e-post
                </label>
                <Input
                  id="dela-coach"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCoach();
                    }
                  }}
                  placeholder="coachens@epost.se"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  onClick={addCoach}
                  disabled={pending || !email.trim()}
                >
                  Lägg till
                </Button>
              </div>
            </div>
          )}
          <p className="text-[0.75rem] text-text-subtle">
            Coacher använder {thing} med sina adepter och kopierar {it} till
            sitt eget bibliotek.
          </p>
        </section>

        {error && (
          <p role="alert" className="text-sm text-warn">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={pending} className="font-semibold">
            {pending ? "Sparar…" : "Spara"}
          </Button>
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            Avbryt
          </Button>
        </div>
      </div>
    </dialog>
  );
}
