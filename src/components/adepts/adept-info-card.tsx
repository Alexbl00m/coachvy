"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { AdeptForm } from "@/components/adepts/adept-form";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { updateAdept } from "@/lib/adepts/actions";
import type { Adept } from "@/lib/types/database";

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="border-b border-ink-800 py-3 last:border-b-0 sm:grid sm:grid-cols-[160px_1fr] sm:gap-4">
      <dt className="text-[13px] text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-100 sm:mt-0">
        {value?.trim() ? value : "–"}
      </dd>
    </div>
  );
}

export function AdeptInfoCard({
  adept,
  canEdit,
}: {
  adept: Adept;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <CardTitle
        action={
          canEdit && !editing ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden className="size-3.5" />
              Redigera
            </Button>
          ) : null
        }
      >
        Grundinfo
      </CardTitle>

      {editing ? (
        <AdeptForm
          action={updateAdept}
          adept={adept}
          submitLabel="Spara ändringar"
          onCancel={
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Avbryt
            </Button>
          }
        />
      ) : (
        <dl>
          <Row label="Namn" value={adept.full_name} />
          <Row label="E-post" value={adept.email} />
          <Row label="Sport" value={adept.sport} />
          <Row label="Mål" value={adept.goal} />
          <Row label="Nuvarande nivå" value={adept.current_level} />
          <Row
            label="Konto"
            value={
              adept.profile_id
                ? "Adepten har ett eget konto"
                : "Inget konto kopplat ännu"
            }
          />
        </dl>
      )}
    </Card>
  );
}
