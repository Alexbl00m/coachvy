"use client";

import { useActionState, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { emptyFormState } from "@/lib/form-state";
import { addVlamaxSample } from "@/lib/vlamax/actions";
import { countBySex } from "@/lib/vlamax/model";
import type { VlamaxSample } from "@/lib/types/database";

export function ReferenceData({ samples }: { samples: VlamaxSample[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    addVlamaxSample,
    emptyFormState,
  );

  const counts = countBySex(samples);

  return (
    <Card className="mt-6">
      <CardTitle
        action={
          <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? (
              <ChevronDown aria-hidden className="size-3.5" />
            ) : (
              <Plus aria-hidden className="size-3.5" />
            )}
            {open ? "Stäng" : "Lägg till mätning"}
          </Button>
        }
      >
        Referensdata ({samples.length})
      </CardTitle>

      <p className="text-sm text-text-muted">
        Modellen tränas på {samples.length} atleter där VLamax faktiskt mätts —{" "}
        {counts.man} män och {counts.kvinna}{" "}
        {counts.kvinna === 1 ? "kvinna" : "kvinnor"}. Varje ny mätning du lägger
        till gör den bättre.
      </p>

      {counts.kvinna < 5 && (
        <p className="mt-3 rounded-md border border-line bg-surface-2 p-3 text-[12px] leading-relaxed text-text-muted">
          Kön är en variabel i modellen, och den vilar på bara {counts.kvinna}{" "}
          {counts.kvinna === 1 ? "kvinna" : "kvinnor"}. Beräkningar för kvinnor
          är därför betydligt osäkrare än siffran ovan antyder — behandla dem som
          en grov indikation tills fler mätningar finns.
        </p>
      )}

      {open && (
        <form action={formAction} className="mt-5 space-y-4 border-t border-line pt-5">
          <FormMessage error={state.error} notice={state.notice} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Namn eller etikett" htmlFor="label">
              <Input
                id="label"
                name="label"
                required
                defaultValue={state.values?.label ?? ""}
                placeholder="T.ex. Atlet 14"
              />
            </Field>

            <Field label="Kön" htmlFor="sample_sex">
              <Select
                key={`sex-${state.values?.sex ?? ""}`}
                id="sample_sex"
                name="sex"
                defaultValue={state.values?.sex || "man"}
              >
                <option value="man">Man</option>
                <option value="kvinna">Kvinna</option>
              </Select>
            </Field>

            <Field label="Uppmätt VLamax" htmlFor="vlamax" hint="mmol/l/s">
              <Input
                id="vlamax"
                name="vlamax"
                inputMode="decimal"
                required
                defaultValue={state.values?.vlamax ?? ""}
                placeholder="0,45"
              />
            </Field>

            <Field label="Vikt" htmlFor="weight_kg" hint="kg">
              <Input
                id="weight_kg"
                name="weight_kg"
                inputMode="decimal"
                required
                defaultValue={state.values?.weight_kg ?? ""}
              />
            </Field>

            <Field label="Kroppsfett" htmlFor="body_fat_pct" hint="%">
              <Input
                id="body_fat_pct"
                name="body_fat_pct"
                inputMode="decimal"
                required
                defaultValue={state.values?.body_fat_pct ?? ""}
              />
            </Field>

            <Field label="Sprintlängd" htmlFor="sprint_seconds" hint="sekunder">
              <Input
                id="sprint_seconds"
                name="sprint_seconds"
                inputMode="decimal"
                required
                defaultValue={state.values?.sprint_seconds ?? ""}
              />
            </Field>

            <Field label="Snitteffekt" htmlFor="watt_avg" hint="W">
              <Input
                id="watt_avg"
                name="watt_avg"
                inputMode="decimal"
                required
                defaultValue={state.values?.watt_avg ?? ""}
              />
            </Field>

            <Field label="Toppeffekt" htmlFor="watt_peak" hint="W">
              <Input
                id="watt_peak"
                name="watt_peak"
                inputMode="decimal"
                required
                defaultValue={state.values?.watt_peak ?? ""}
              />
            </Field>

            <Field label="Längd" htmlFor="height_cm" hint="cm" optional>
              <Input
                id="height_cm"
                name="height_cm"
                inputMode="decimal"
                defaultValue={state.values?.height_cm ?? ""}
              />
            </Field>

            <Field label="Ålder" htmlFor="age" optional>
              <Input
                id="age"
                name="age"
                inputMode="numeric"
                defaultValue={state.values?.age ?? ""}
              />
            </Field>
          </div>

          <Button type="submit" disabled={pending} className="font-semibold">
            {pending ? "Sparar…" : "Lägg till i referensdatan"}
          </Button>
        </form>
      )}
    </Card>
  );
}
