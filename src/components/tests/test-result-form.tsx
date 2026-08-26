"use client";

import { useActionState, useState } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { createTestResult } from "@/lib/tests/actions";
import { CUSTOM_TYPE } from "@/lib/tests/constants";
import { emptyFormState } from "@/lib/form-state";
import type { TestType } from "@/lib/types/database";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TestResultForm({
  adeptId,
  testTypes,
  onDone,
}: {
  adeptId: string;
  testTypes: TestType[];
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    createTestResult,
    emptyFormState,
  );

  const [typeId, setTypeId] = useState(testTypes[0]?.id ?? CUSTOM_TYPE);
  // The unit follows the chosen test type but stays editable: the same test
  // is measured differently across sports (watt on a bike, min/km running).
  const [unit, setUnit] = useState(testTypes[0]?.default_unit ?? "");

  const isCustom = typeId === CUSTOM_TYPE;

  function handleTypeChange(nextId: string) {
    setTypeId(nextId);
    if (nextId === CUSTOM_TYPE) {
      setUnit("");
      return;
    }
    const match = testTypes.find((type) => type.id === nextId);
    if (match) setUnit(match.default_unit);
  }

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        onDone?.();
      }}
      className="space-y-4"
    >
      <input type="hidden" name="adept_id" value={adeptId} />

      <FormMessage error={state.error} notice={state.notice} />

      <Field label="Testtyp" htmlFor="test_type_id">
        <Select
          id="test_type_id"
          name="test_type_id"
          value={typeId}
          onChange={(event) => handleTypeChange(event.target.value)}
        >
          {testTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
              {type.coach_id ? " (egen)" : ""}
            </option>
          ))}
          <option value={CUSTOM_TYPE}>+ Lägg till egen testtyp…</option>
        </Select>
      </Field>

      {isCustom && (
        <div className="grid gap-4 rounded-md border border-ink-700 bg-ink-800/50 p-4 sm:grid-cols-2">
          <Field label="Namn på testtyp" htmlFor="custom_label">
            <Input
              id="custom_label"
              name="custom_label"
              required
              defaultValue={state.values?.custom_label ?? ""}
              placeholder="T.ex. Wingate"
            />
          </Field>
          <Field label="Standardenhet" htmlFor="custom_unit">
            <Input
              id="custom_unit"
              name="custom_unit"
              required
              defaultValue={state.values?.custom_unit ?? ""}
              placeholder="T.ex. W"
              onChange={(event) => setUnit(event.target.value)}
            />
          </Field>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Värde" htmlFor="value">
          <Input
            id="value"
            name="value"
            inputMode="decimal"
            required
            defaultValue={state.values?.value ?? ""}
            placeholder="T.ex. 285"
          />
        </Field>

        <Field label="Enhet" htmlFor="unit">
          <Input
            id="unit"
            name="unit"
            required
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="W"
          />
        </Field>

        <Field label="Datum" htmlFor="tested_on">
          <Input
            id="tested_on"
            name="tested_on"
            type="date"
            required
            defaultValue={state.values?.tested_on || today()}
          />
        </Field>
      </div>

      <Field label="Kommentar" htmlFor="comment" optional>
        <Textarea
          id="comment"
          name="comment"
          rows={2}
          defaultValue={state.values?.comment ?? ""}
          placeholder="Förhållanden, utrustning, hur testet kändes…"
        />
      </Field>

      <Button type="submit" disabled={pending} className="font-semibold">
        {pending ? "Sparar…" : "Spara testresultat"}
      </Button>
    </form>
  );
}
