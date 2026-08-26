/**
 * Lives outside `actions.ts` because a `"use server"` module may only export
 * async functions — a plain constant there invalidates the whole module.
 */

/** Sentinel value the type dropdown uses for "add my own type". */
export const CUSTOM_TYPE = "__custom__";
