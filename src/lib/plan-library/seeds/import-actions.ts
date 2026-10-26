"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

import { seedRows, type PlanSeed } from "./build";
import { CYCLING_PLANS } from "./cycling";

/** Alla färdiga planer som finns som data. */
const SEEDS: PlanSeed[] = [...CYCLING_PLANS];

export type SeedStatus = {
  slug: string;
  title: string;
  /** "saknas", "utkast" eller "publicerad". */
  state: "saknas" | "utkast" | "publicerad";
};

/** Vilka av de färdiga planerna som redan finns i biblioteket. */
export async function seedStatus(): Promise<SeedStatus[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("plan_templates")
    .select("id, slug")
    .in(
      "slug",
      SEEDS.map((s) => s.slug),
    );
  const ids = (templates ?? []).map((t) => t.id);
  const { data: published } = ids.length
    ? await supabase
        .from("plan_template_versions")
        .select("template_id")
        .in("template_id", ids)
        .eq("status", "publicerad")
    : { data: [] };
  const found = new Map(
    (templates ?? []).map((t) => [
      t.slug,
      (published ?? []).some((v) => v.template_id === t.id),
    ]),
  );
  return SEEDS.map((s) => ({
    slug: s.slug,
    title: s.title,
    state: !found.has(s.slug) ? "saknas" : found.get(s.slug) ? "publicerad" : "utkast",
  }));
}

export type ImportResult = { slug: string; ok: boolean; message: string };

/**
 * Läser in de färdiga planer som saknas, ägda av den inloggade admin och
 * delade med medlemmar och coacher, och publicerar dem. Publiceringen
 * kontrollerar planen i databasen. Går något fel tas planen bort igen, så
 * att inget halvfärdigt ligger kvar.
 */
export async function importSeedPlans(): Promise<ImportResult[]> {
  const user = await requireAdmin();
  const supabase = await createClient();

  const [{ data: categories }, status] = await Promise.all([
    supabase.from("plan_categories").select("id, key"),
    seedStatus(),
  ]);
  const categoryId = new Map((categories ?? []).map((c) => [c.key, c.id]));
  const results: ImportResult[] = [];

  for (const seed of SEEDS) {
    const state = status.find((s) => s.slug === seed.slug)?.state;
    if (state === "publicerad") {
      results.push({ slug: seed.slug, ok: true, message: "Fanns redan." });
      continue;
    }

    const rows = seedRows(seed);
    const versionId = rows.version.id as string;
    const cleanup = async () => {
      await supabase.from("plan_template_versions").delete().eq("id", versionId);
      await supabase.from("plan_templates").delete().eq("id", rows.template.id);
    };
    const step = async (
      label: string,
      run: () => PromiseLike<{ error: { message: string } | null }>,
    ) => {
      const { error } = await run();
      if (error) throw new Error(`${label}: ${error.message}`);
    };

    try {
      if (state === "saknas") {
        await step("mallen", () =>
          supabase.from("plan_templates").insert({
            id: rows.template.id,
            slug: rows.template.slug,
            category_id: categoryId.get(rows.template.category) ?? null,
            focus: rows.template.focus,
            created_by: user.id,
            owner_id: user.id,
          } as never),
        );
        await step("versionen", () =>
          supabase
            .from("plan_template_versions")
            .insert({ ...rows.version, created_by: user.id } as never),
        );
        await step("nivåerna", () => supabase.from("plan_template_levels").insert(rows.levels as never));
        await step("faserna", () => supabase.from("plan_template_phases").insert(rows.phases as never));
        await step("veckorna", () => supabase.from("plan_template_weeks").insert(rows.weeks as never));
        await step("passen", () => supabase.from("plan_template_sessions").insert(rows.sessions as never));
        for (let i = 0; i < rows.variants.length; i += 400) {
          await step("passens nivåer", () =>
            supabase
              .from("plan_template_session_variants")
              .insert(rows.variants.slice(i, i + 400) as never),
          );
        }
        await step("veckovolymen", () =>
          supabase.from("plan_template_week_volumes").insert(rows.volumes as never),
        );
        await step("delningen", () =>
          supabase.from("library_shares").insert([
            { template_id: rows.template.id, audience: "medlemmar", created_by: user.id },
            { template_id: rows.template.id, audience: "coacher", created_by: user.id },
          ] as never),
        );
      }
      await step("publiceringen", () =>
        supabase.rpc("publish_plan_version", { draft: versionId } as never),
      );
      results.push({ slug: seed.slug, ok: true, message: "Inläst och publicerad." });
    } catch (e) {
      if (state === "saknas") await cleanup();
      results.push({
        slug: seed.slug,
        ok: false,
        message: e instanceof Error ? e.message : "Okänt fel.",
      });
    }
  }

  revalidatePath(routes.planLibrary);
  revalidatePath(routes.planTemplates);
  return results;
}
