/** Route table for the app. Keep in sync with the folders under `src/app`. */
export const routes = {
  signIn: "/logga-in",
  signUp: "/registrera",
  privacy: "/integritetspolicy",
  dashboard: "/oversikt",
  adepts: "/adepter",
  plans: "/planer",
  newPlan: "/planer/ny",
  testResults: "/testresultat",
  progression: "/progression",
  calendar: "/kalender",
  aiCoach: "/ai-coach",
  community: "/community",
  settings: "/installningar",
} as const;

/** Paths reachable without a session. Matched as prefixes. */
export const publicPaths: readonly string[] = [
  routes.signIn,
  routes.signUp,
  routes.privacy,
  "/auth",
];

export function isPublicPath(pathname: string): boolean {
  return publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
