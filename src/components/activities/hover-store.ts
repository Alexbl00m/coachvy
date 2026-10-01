import { useSyncExternalStore } from "react";

/**
 * Var pekaren står i serien, delat mellan graferna och kartan.
 *
 * Ett vanligt React-tillstånd i föräldern hade ritat om alla grafer, med två
 * tusen punkter var, för varje musrörelse. Här prenumererar bara det som
 * behöver indexet – kartans markör och avläsningen.
 */
export function createHoverStore() {
  let index: number | null = null;
  const listeners = new Set<() => void>();
  return {
    set(next: number | null) {
      if (next === index) return;
      index = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: () => index,
  };
}

export type HoverStore = ReturnType<typeof createHoverStore>;

export function useHoverIndex(store: HoverStore): number | null {
  return useSyncExternalStore(store.subscribe, store.get, () => null);
}
