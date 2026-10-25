"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import { reviewShare } from "@/lib/sharing/actions";
import type { ReviewItem } from "@/lib/sharing/queries";

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short" }).format(
    new Date(iso),
  );

const STATUS: Record<ReviewItem["status"], string> = {
  granskas: "Väntar",
  aktiv: "Godkänd",
  avslagen: "Avslagen",
};

const hrefOf = (item: ReviewItem) =>
  item.kind === "plan" && item.slug
    ? `${routes.planLibrary}/${item.slug}`
    : `${routes.sessionLibrary}?sok=${encodeURIComponent(item.title)}`;

function Row({ item }: { item: ReviewItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState(item.reviewNote ?? "");
  const [error, setError] = useState<string | null>(null);

  const decide = (approve: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await reviewShare({ shareId: item.id, approve, note });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRejecting(false);
      router.refresh();
    });
  };

  return (
    <li className="space-y-2 px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="min-w-0 flex-1">
          <Link
            href={hrefOf(item)}
            className="block truncate text-sm font-medium text-text hover:underline"
          >
            {item.title}
          </Link>
          <span className="block text-[0.8125rem] text-text-subtle">
            {[
              item.kind === "plan" ? "Plan" : "Pass",
              item.ownerName,
              `delad ${shortDate(item.createdAt)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[0.75rem] font-medium",
            item.status === "granskas"
              ? "bg-accent-soft text-text"
              : "bg-surface-3 text-text-muted",
          )}
        >
          {STATUS[item.status]}
        </span>
        <span className="flex gap-1.5">
          {item.status !== "aktiv" && (
            <Button size="sm" disabled={pending} onClick={() => decide(true)}>
              Godkänn
            </Button>
          )}
          {item.status !== "avslagen" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => setRejecting((r) => !r)}
            >
              {item.status === "aktiv" ? "Dra tillbaka" : "Avslå"}
            </Button>
          )}
        </span>
      </div>
      {item.status === "avslagen" && item.reviewNote && !rejecting && (
        <p className="text-[0.8125rem] text-text-muted">{item.reviewNote}</p>
      )}
      {rejecting && (
        <div className="space-y-2">
          <label htmlFor={`not-${item.id}`} className="sr-only">
            Varför
          </label>
          <Textarea
            id={`not-${item.id}`}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Vad behöver ändras för att medlemmarna ska se det?"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => decide(false)}
          >
            Skicka till coachen
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-warn">
          {error}
        </p>
      )}
    </li>
  );
}

/**
 * Pass och planer som coacher delat med alla medlemmar. Det som väntar står
 * först; det som redan granskats går att ändra beslutet för.
 */
export function ReviewQueue({ items }: { items: ReviewItem[] }) {
  const waiting = items.filter((i) => i.status === "granskas").length;
  return (
    <Card className="mb-6 p-0 sm:p-0">
      <div className="px-5 pt-5 sm:px-6 sm:pt-6">
        <CardTitle>Granskning</CardTitle>
        <p className="mt-1 text-[0.8125rem] text-text-muted">
          {waiting > 0
            ? `${waiting} att granska. Det du godkänner ser alla medlemmar i Coachvy.`
            : "Inget väntar. Det du godkänt ser alla medlemmar i Coachvy."}
        </p>
      </div>
      {items.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {items.map((item) => (
            <Row key={item.id} item={item} />
          ))}
        </ul>
      )}
    </Card>
  );
}
