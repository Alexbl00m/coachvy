"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  saveVersionMeta,
  updateTemplate,
} from "@/lib/plan-library/admin-actions";

import { useAction } from "../use-action";

type Meta = {
  title: string;
  summary: string;
  goal: string;
  description: string;
  prerequisites: string;
  minWeeks: number;
};

/** Planens namn, texter och längd, och mallens adress och mål. */
export function MetaForm({
  templateId,
  versionId,
  editable,
  initial,
  maxWeeks,
  slug: initialSlug,
  categoryId: initialCategory,
  categories,
}: {
  templateId: string;
  versionId: string;
  editable: boolean;
  initial: Meta;
  maxWeeks: number;
  slug: string;
  categoryId: string | null;
  categories: { id: string; name: string }[];
}) {
  const [meta, setMeta] = useState(initial);
  const [slug, setSlug] = useState(initialSlug);
  const [categoryId, setCategoryId] = useState(initialCategory ?? "");
  const { pending, error, run } = useAction();
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<Meta>) => {
    setSaved(false);
    setMeta((m) => ({ ...m, ...patch }));
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          async () => {
            const t = await updateTemplate({
              templateId,
              slug,
              categoryId: categoryId || null,
            });
            if (!t.ok || !editable) return t;
            return saveVersionMeta({ versionId, ...meta });
          },
          () => setSaved(true),
        );
      }}
    >
      <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
        <Field label="Namn" htmlFor="meta-titel">
          <Input
            id="meta-titel"
            value={meta.title}
            onChange={(e) => set({ title: e.target.value })}
            required
          />
        </Field>
        <Field
          label="Kortaste längd"
          htmlFor="meta-min"
          hint={`Längsta är ${maxWeeks} veckor – lika många som planens veckor.`}
        >
          <Input
            id="meta-min"
            type="number"
            min={1}
            max={maxWeeks}
            value={meta.minWeeks}
            onChange={(e) => set({ minWeeks: Number(e.target.value) })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="I en mening"
            htmlFor="meta-summary"
            optional
            hint="Visas på kortet i biblioteket."
          >
            <Input
              id="meta-summary"
              value={meta.summary}
              onChange={(e) => set({ summary: e.target.value })}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Målet" htmlFor="meta-goal" optional>
            <Textarea
              id="meta-goal"
              rows={2}
              value={meta.goal}
              onChange={(e) => set({ goal: e.target.value })}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Beskrivning" htmlFor="meta-description" optional>
            <Textarea
              id="meta-description"
              rows={6}
              value={meta.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field
            label="Förkunskaper"
            htmlFor="meta-pre"
            optional
            hint="Vad medlemmen bör klara innan planen börjar."
          >
            <Textarea
              id="meta-pre"
              rows={3}
              value={meta.prerequisites}
              onChange={(e) => set({ prerequisites: e.target.value })}
            />
          </Field>
        </div>
      </fieldset>

      <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
        <Field label="Mål i biblioteket" htmlFor="meta-category">
          <Select
            id="meta-category"
            value={categoryId}
            onChange={(e) => {
              setSaved(false);
              setCategoryId(e.target.value);
            }}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="">Inget mål</option>
          </Select>
        </Field>
        <Field
          label="Adress"
          htmlFor="meta-slug"
          hint="Gäller mallen, inte en version. Ändras den slutar gamla länkar fungera."
        >
          <Input
            id="meta-slug"
            value={slug}
            onChange={(e) => {
              setSaved(false);
              setSlug(e.target.value);
            }}
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          Spara
        </Button>
        {saved && <span className="text-sm text-text-muted">Sparat.</span>}
        {error && (
          <span role="alert" className="text-sm text-warn">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
