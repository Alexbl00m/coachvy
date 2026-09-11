/**
 * Passbyggaren behöver en nyckel till Anthropics API. Precis som med Supabase
 * är den valfri: utan nyckel går appen att köra, men prompt-rutan säger vad
 * som saknas i stället för att svara med ett fel.
 */
export function isAnthropicConfigured(): boolean {
  return (process.env.ANTHROPIC_API_KEY ?? "").length > 0;
}
