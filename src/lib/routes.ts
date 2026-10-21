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
  activities: "/app/aktiviteter",
  newPlan: "/app/planer/ny",
  library: "/app/bibliotek",
  log: "/app/logga",
  more: "/app/mer",
  tools: "/app/verktyg",
  workoutBuilder: "/app/pass",
  sessionLibrary: "/app/passbibliotek",
  runningPlanner: "/app/lopplanerare",
  planLibrary: "/app/planbibliotek",
  planTemplates: "/app/planbibliotek/mallar",
  myPlan: "/app/min-plan",
  testResults: "/app/testresultat",
  calculators: "/app/kalkyler",
  bikePower: "/app/kalkyler/cykeleffekt",
  lactateThresholds: "/app/kalkyler/laktattrosklar",
  criticalPower: "/app/kalkyler/critical-power",
  criticalSpeed: "/app/kalkyler/critical-speed",
  metabolicProfile: "/app/kalkyler/metabolisk-profil",
  vlamax: "/app/kalkyler/vlamax",
  progression: "/app/progression",
  strength: "/app/styrka",
  calendar: "/app/kalender",
  aiCoach: "/app/ai-coach",
  community: "/app/community",
  settings: "/app/installningar",
  admin: "/app/admin",
} as const;

/**
 * Adeptens arbetsyta: en flik eller undervy under adeptens adress. Allt som
 * gäller en adept bor här, så att coachen hittar det på ett ställe.
 */
export const ADEPT_SECTIONS = {
  lage: "",
  plan: "plan",
  pass: "plan/pass",
  bibliotek: "plan/bibliotek",
  traning: "traning",
  styrka: "traning/styrka",
  tester: "tester",
  progression: "tester/progression",
  varden: "tester/varden",
  maende: "maende",
  meddelanden: "meddelanden",
  profil: "profil",
} as const;

export type AdeptSection = keyof typeof ADEPT_SECTIONS;

export function adeptHref(id: string, section: AdeptSection = "lage"): string {
  const path = ADEPT_SECTIONS[section];
  return path ? `${routes.adepts}/${id}/${path}` : `${routes.adepts}/${id}`;
}

/** Flikarna som tidigare låg i `?vy=` på adeptsidan, till sina nya adresser. */
export const LEGACY_ADEPT_VIEWS: Record<string, AdeptSection> = {
  oversikt: "lage",
  testtillfallen: "tester",
  pass: "pass",
  aktiviteter: "traning",
  maende: "maende",
  meddelanden: "meddelanden",
  testresultat: "varden",
};

/** The prefix that requires a session. */
export const APP_PREFIX = "/app";

export function isProtectedPath(pathname: string): boolean {
  return pathname === APP_PREFIX || pathname.startsWith(`${APP_PREFIX}/`);
}
