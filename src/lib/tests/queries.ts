import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { TestResult, TestType } from "@/lib/types/database";

/** A result joined with its type, which is what every view actually needs. */
export type TestResultWithType = TestResult & {
  test_type: Pick<TestType, "id" | "label" | "default_unit"> | null;
};

/**
 * Built-in types plus the signed-in coach's own. RLS also lets an adept read
 * their coach's custom types, so their own results always render a type name.
 */
export async function listTestTypes(): Promise<TestType[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_types")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) throw new Error(`Kunde inte hämta testtyper: ${error.message}`);
  return data ?? [];
}

export async function listTestResults(
  adeptId: string,
): Promise<TestResultWithType[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_results")
    .select("*, test_type:test_types(id, label, default_unit)")
    .eq("adept_id", adeptId)
    .order("tested_on", { ascending: true });

  if (error) throw new Error(`Kunde inte hämta testresultat: ${error.message}`);
  return (data ?? []) as unknown as TestResultWithType[];
}
