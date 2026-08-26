"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { emptyFormState } from "@/lib/form-state";
import { saveVlamaxAsTestResult } from "@/lib/vlamax/actions";
import type { Adept } from "@/lib/types/database";

export function SaveAsTestResult({
  adepts,
  value,
}: {
  adepts: Adept[];
  value: number;
}) {
  const [state, formAction, pending] = useActionState(
    saveVlamaxAsTestResult,
    emptyFormState,
  );

  if (adepts.length === 0) {
    return (
      <Card>
        <CardTitle>Spara på adept</CardTitle>
        <p className="text-sm text-text-muted">
          Lägg upp en adept först, så kan beräkningen sparas i adeptens kurva.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>Spara på adept</CardTitle>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="value" value={value.toFixed(3)} />

        <FormMessage error={state.error} notice={state.notice} />

        <Field label="Adept" htmlFor="adept_id">
          <Select id="adept_id" name="adept_id" defaultValue={adepts[0].id}>
            {adepts.map((adept) => (
              <option key={adept.id} value={adept.id}>
                {adept.full_name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Datum" htmlFor="tested_on">
          <Input
            id="tested_on"
            name="tested_on"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </Field>

        <Button type="submit" disabled={pending} className="w-full font-semibold">
          {pending ? "Sparar…" : `Spara ${value.toFixed(2)} mmol/l/s`}
        </Button>

        <p className="text-[12px] text-text-subtle">
          Resultatet märks som beräknat, så att det inte förväxlas med ett
          uppmätt värde.
        </p>
      </form>
    </Card>
  );
}
