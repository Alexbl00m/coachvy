/**
 * Shared shape for Server Function results that feed `useActionState`.
 *
 * React resets an uncontrolled form once the action resolves, so a failed
 * submission echoes back what was typed and the form re-seeds its defaults
 * from `values`.
 */
export type FormState = {
  error?: string;
  notice?: string;
  values?: Record<string, string>;
};

export const emptyFormState: FormState = {};

/** Trimmed string field from a submitted form. */
export function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Same as `field`, but null instead of an empty string, for nullable columns. */
export function optionalField(formData: FormData, key: string): string | null {
  return field(formData, key) || null;
}
