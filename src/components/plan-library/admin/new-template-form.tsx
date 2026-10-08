"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { createTemplate } from "@/lib/plan-library/admin-actions";
import { routes } from "@/lib/routes";

import { useAction } from "../use-action";

export function NewTemplateForm({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { pending, error, run } = useAction();
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");

  return (
    <form
      className="grid gap-4 sm:grid-cols-[1fr_14rem_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => createTemplate({ title, categoryId: categoryId || null }),
          (r) => router.push(`${routes.planTemplates}/${r.id}`),
        );
      }}
    >
      <Field label="Namn" htmlFor="ny-mall-namn">
        <Input
          id="ny-mall-namn"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Maraton, 12–16 veckor"
          required
        />
      </Field>
      <Field label="Mål" htmlFor="ny-mall-mal">
        <Select
          id="ny-mall-mal"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="">Inget mål</option>
        </Select>
      </Field>
      <Button type="submit" disabled={pending || !title.trim()}>
        <Plus aria-hidden className="size-4" />
        Skapa mall
      </Button>
      {error && (
        <p role="alert" className="text-sm text-warn sm:col-span-3">
          {error}
        </p>
      )}
    </form>
  );
}
