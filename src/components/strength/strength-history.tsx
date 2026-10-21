"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

import { deleteStrengthSession } from "@/lib/strength/actions";
import { entryText, type StrengthSession } from "@/lib/strength/strength";

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];
const WEEKDAYS = ["mån", "tis", "ons", "tor", "fre", "lör", "sön"];
const dateText = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  const weekday =
    (Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000) + 3) % 7;
  return `${WEEKDAYS[weekday]} ${d} ${MONTHS[m - 1]}`;
};

/** De loggade passen, nyast först, med ändra och ta bort. */
export function StrengthHistory({
  sessions,
  basePath,
}: {
  sessions: StrengthSession[];
  /** Sidan loggen ligger på; "Ändra" öppnar passet i formuläret där. */
  basePath: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (sessions.length === 0) {
    return (
      <p className="text-[13px] text-text-subtle">Inga pass loggade ännu.</p>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {sessions.map((s) => (
        <li key={s.id} className="flex gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text">
              {s.title || "Styrkepass"}
              <span className="ml-2 text-[12px] font-normal text-text-subtle tabular-nums">
                {dateText(s.performed_on)}
                {s.session_rpe !== null &&
                  ` · RPE ${String(s.session_rpe).replace(".", ",")}`}
              </span>
            </p>
            <p className="mt-0.5 text-[13px] text-text-muted">
              {s.exercises
                .map((e) => {
                  const detail = entryText(e);
                  return detail === "–" ? e.name : `${e.name} ${detail}`;
                })
                .join(" · ")}
            </p>
            {s.note && (
              <p className="mt-0.5 text-[12px] text-text-subtle">{s.note}</p>
            )}
          </div>
          <div className="flex shrink-0 items-start gap-1">
            <Link
              href={`${basePath}?andra=${s.id}`}
              aria-label={`Ändra passet ${dateText(s.performed_on)}`}
              className="rounded-md p-1.5 text-text-subtle transition-colors hover:text-text"
            >
              <Pencil aria-hidden className="size-4" />
            </Link>
            <button
              type="button"
              disabled={pending}
              aria-label={`Ta bort passet ${dateText(s.performed_on)}`}
              onClick={() => {
                if (!window.confirm("Ta bort passet?")) return;
                start(async () => {
                  const result = await deleteStrengthSession(s.id);
                  if (!result.ok) window.alert(result.error);
                  router.refresh();
                });
              }}
              className="rounded-md p-1.5 text-text-subtle transition-colors hover:text-text disabled:opacity-40"
            >
              <Trash2 aria-hidden className="size-4" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
