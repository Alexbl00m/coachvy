/** Route table for the app. Keep in sync with the folders under `src/app`. */
export const routes = {
  // Public marketing site
  home: "/",
  coaching: "/#coaching",
  testing: "/#testning",
  about: "/#om-mig",
  blog: "/#blogg",
  contact: "/#kontakt",
  privacy: "/integritetspolicy",

  // Auth
  signIn: "/logga-in",
  signUp: "/registrera",

  // Everything behind a session lives under /app, so the proxy can protect it
  // by prefix instead of by a list of public paths that is easy to forget.
  dashboard: "/app/oversikt",
  adepts: "/app/adepter",
  newAdept: "/app/adepter/ny",
  plans: "/app/planer",
  newPlan: "/app/planer/ny",
  testResults: "/app/testresultat",
  vlamax: "/app/vlamax",
  progression: "/app/progression",
  calendar: "/app/kalender",
  aiCoach: "/app/ai-coach",
  community: "/app/community",
  settings: "/app/installningar",
} as const;

/** The prefix that requires a session. */
export const APP_PREFIX = "/app";

export function isProtectedPath(pathname: string): boolean {
  return pathname === APP_PREFIX || pathname.startsWith(`${APP_PREFIX}/`);
}
