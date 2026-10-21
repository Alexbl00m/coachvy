import {
  Activity,
  BarChart3,
  BicepsFlexed,
  Bot,
  CalendarDays,
  ChartBarBig,
  ClipboardList,
  Dumbbell,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  LayoutTemplate,
  Library,
  LibraryBig,
  ListChecks,
  MessagesSquare,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { routes } from "@/lib/routes";
import type { AccountRole } from "@/lib/types/database";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * Sidor under posten, visade under den när man är i avsnittet. Posten är
   * vald också på deras adresser.
   */
  children?: NavItem[];
};

export type NavSection = {
  /** Rendered above the group; omit for the primary group. */
  title?: string;
  items: NavItem[];
};

/**
 * Coachens meny: sju poster ordnade efter arbetet, inte efter verktygen.
 * Allt som gäller en adept bor i adeptens arbetsyta under Adepter.
 */
function coachSections(isAdmin: boolean): NavSection[] {
  return [
    {
      items: [
        { label: "Översikt", href: routes.dashboard, icon: LayoutDashboard },
        { label: "Adepter", href: routes.adepts, icon: Users },
        { label: "Kalender", href: routes.calendar, icon: CalendarDays },
        {
          label: "Bibliotek",
          href: routes.library,
          icon: Library,
          children: [
            {
              label: "Passbibliotek",
              href: routes.sessionLibrary,
              icon: LibraryBig,
            },
            { label: "Planbibliotek", href: routes.planLibrary, icon: Library },
            ...(isAdmin
              ? [
                  {
                    label: "Planmallar",
                    href: routes.planTemplates,
                    icon: LayoutTemplate,
                  },
                ]
              : []),
          ],
        },
        {
          label: "Verktyg",
          href: routes.tools,
          icon: Wrench,
          children: [
            {
              label: "Passbyggare",
              href: routes.workoutBuilder,
              icon: Dumbbell,
            },
            {
              label: "Löpplanerare",
              href: routes.runningPlanner,
              icon: ChartBarBig,
            },
            { label: "Kalkyler", href: routes.calculators, icon: Gauge },
            { label: "AI-coach", href: routes.aiCoach, icon: Bot },
          ],
        },
        { label: "Community", href: routes.community, icon: MessagesSquare },
        { label: "Inställningar", href: routes.settings, icon: Settings },
      ],
    },
    ...(isAdmin
      ? [
          {
            title: "Admin",
            items: [{ label: "Admin", href: routes.admin, icon: UserCog }],
          },
        ]
      : []),
  ];
}

/**
 * Adeptens meny. Den görs om i nästa steg av omtaget – en egen app med fem
 * flikar – och är tills dess densamma som förut.
 */
function adeptSections(): NavSection[] {
  return [
    {
      items: [
        { label: "Översikt", href: routes.dashboard, icon: LayoutDashboard },
        { label: "Passbyggare", href: routes.workoutBuilder, icon: Dumbbell },
        {
          label: "Löpplanerare",
          href: routes.runningPlanner,
          icon: ChartBarBig,
        },
        { label: "Säsongsplan", href: routes.plans, icon: ClipboardList },
        { label: "Planbibliotek", href: routes.planLibrary, icon: Library },
        { label: "Min plan", href: routes.myPlan, icon: ListChecks },
        {
          label: "Lopp och aktiviteter",
          href: routes.activities,
          icon: Activity,
        },
        { label: "Testresultat", href: routes.testResults, icon: FlaskConical },
        { label: "Progression", href: routes.progression, icon: BarChart3 },
        { label: "Styrka", href: routes.strength, icon: BicepsFlexed },
        { label: "Kalender", href: routes.calendar, icon: CalendarDays },
      ],
    },
    {
      title: "Verktyg",
      items: [
        { label: "Community", href: routes.community, icon: MessagesSquare },
      ],
    },
    {
      title: "Konto",
      items: [
        {
          label: "Integritetspolicy & villkor",
          href: routes.privacy,
          icon: ShieldCheck,
        },
        { label: "Inställningar", href: routes.settings, icon: Settings },
      ],
    },
  ];
}

/**
 * The menu an account should see. Coaches (and the demo shell without a
 * role) get the coach menu; adepts their own.
 */
export function getNavSections(
  role: AccountRole | null,
  isAdmin = false,
): NavSection[] {
  return role === "adept" ? adeptSections() : coachSections(isAdmin);
}
