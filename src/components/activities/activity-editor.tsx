"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { deleteActivity, updateActivity } from "@/lib/activities/actions";
import { routes } from "@/lib/routes";
import type { RaceChoice } from "./activity-upload";

/**
 * Namn, anteckning, om det var en tävling och i så fall vilken planerad – och
 * att ta bort aktiviteten. En tävling behöver inte vara planerad.
 */
export function ActivityEditor({
  id,
  adeptId,
  name: initialName,
  note: initialNote,
  raceId: initialRace,
  isRace: initialIsRace,
  races,
}: {
  id: string;
  adeptId: string;
  name: string;
  note: string | null;
  raceId: string | null;
  isRace: boolean;
  races: RaceChoice[];
}) {
  const router = useRouter();
  const nameId = useId();
  const noteId = useId();
  const raceId = useId();
  const [name, setName] = useState(initialName);
  const [note, setNote] = useState(initialNote ?? "");
  const [race, setRace] = useState(initialRace ?? "");
  const [isRace, setIsRace] = useState(initialIsRace || Boolean(initialRace));
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await updateActivity(id, adeptId, {
        name,
        note,
        raceId: isRace ? race || null : null,
        isRace,
      });
      setMessage(result.ok ? "Sparat." : (result.error ?? "Kunde inte spara."));
      if (result.ok) router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      const result = await deleteActivity(id, adeptId);
      if (result.ok) {
        router.push(`${routes.adepts}/${adeptId}?vy=aktiviteter`);
        return;
      }
      setMessage(result.error ?? "Kunde inte ta bort.");
    });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Namn" htmlFor={nameId}>
          <Input
            id={nameId}
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2">
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
      <Field
        label="Anteckning"
        htmlFor={noteId}
        optional
        hint="Väder, taktik, hur det kändes – det filen inte vet."
      >
        <Textarea
          id={noteId}
          rows={3}
          value={note}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={pending || !name.trim()}>
          Spara
        </Button>
        {confirming ? (
          <>
            <Button variant="secondary" onClick={remove} disabled={pending}>
              Ja, ta bort
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Avbryt
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            onClick={() => setConfirming(true)}
            disabled={pending}
          >
            Ta bort aktiviteten
          </Button>
        )}
        {message && (
          <span role="status" className="text-[13px] text-text-muted">
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
