/**
 * Supabase is optional during phase 1 so the skeleton can be started and
 * browsed before a project has been provisioned. Everything that talks to
 * Supabase checks `isSupabaseConfigured()` first and degrades gracefully.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase saknar konfiguration. Kopiera .env.example till .env.local och fyll i NEXT_PUBLIC_SUPABASE_URL och NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
}
