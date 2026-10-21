import {
  Activity,
  BarChart3,
  BicepsFlexed,
  Bot,
  CalendarDays,
  ChartBarBig,
  CirclePlus,
  ClipboardList,
  Dumbbell,
  Ellipsis,
  FlaskConical,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  LayoutTemplate,
  Library,
  LibraryBig,
  ListChecks,
  MessageSquare,
  MessagesSquare,
  Settings,
  Sun,
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { adeptHref, routes, type AdeptSection } from "@/lib/routes";
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
 * Adeptens app: fem avsnitt, samma i sidomenyn och i bottenraden på
 * telefonen. Idag först – det adepten öppnar appen för – och sedan planen,
 * det som loggas, utvecklingen och resten under Mer.
 *
 * Adeptens egna sidor i arbetsytan (tester, incheckning, meddelanden) nås
 * med adeptens id; utan adeptrad faller de bort.
 */
function adeptSections(adeptId: string | null): NavSection[] {
  const own = (section: AdeptSection, label: string, icon: LucideIcon) =>
    adeptId ? [{ label, href: adeptHref(adeptId, section), icon }] : [];
  return [
    {
      items: [
        { label: "Idag", href: routes.dashboard, icon: Sun },
        {
          label: "Plan",
          href: routes.calendar,
          icon: CalendarDays,
          children: [
            { label: "Kalender", href: routes.calendar, icon: CalendarDays },
            { label: "Min plan", href: routes.myPlan, icon: ListChecks },
            { label: "Säsong", href: routes.plans, icon: ClipboardList },
          ],
        },
        {
          label: "Logga",
          href: routes.log,
          icon: CirclePlus,
          children: [
            ...own("maende", "Incheckning", HeartPulse),
            { label: "Styrka", href: routes.strength, icon: BicepsFlexed },
            {
              label: "Lopp och aktiviteter",
              href: routes.activities,
              icon: Activity,
            },
          ],
        },
        {
          label: "Utveckling",
          href: routes.progression,
          icon: BarChart3,
          children: [
            { label: "Progression", href: routes.progression, icon: BarChart3 },
            ...own("tester", "Tester", FlaskConical),
            ...own("varden", "Enstaka värden", FlaskConical),
          ],
        },
        {
          label: "Mer",
          href: routes.more,
          icon: Ellipsis,
          children: [
            ...own("meddelanden", "Meddelanden", MessageSquare),
            {
              label: "Community",
              href: routes.community,
              icon: MessagesSquare,
            },
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
            { label: "Planbibliotek", href: routes.planLibrary, icon: Library },
            { label: "Inställningar", href: routes.settings, icon: Settings },
          ],
        },
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
  adeptId: string | null = null,
): NavSection[] {
  return role === "adept" ? adeptSections(adeptId) : coachSections(isAdmin);
}

function isActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Posten och dess undersidor, för att avgöra vilken post som är vald. */
export const hrefsOf = (item: NavItem): string[] => [
  item.href,
  ...(item.children ?? []).map((c) => c.href),
];

/**
 * Den länk i menyn som gäller sidan. Den mest specifika vinner: Planmallar
 * ligger under Planbiblioteket, och bara den ena ska vara markerad.
 */
export function activeHref(
  sections: NavSection[],
  pathname: string,
): string | undefined {
  return sections
    .flatMap((section) => section.items.flatMap(hrefsOf))
    .filter((href) => isActive(pathname, href))
    .sort((a, b) => b.length - a.length)[0];
}

/** Avsnittet sidan hör till: posten vars egen eller undersidas länk är vald. */
export function activeItem(
  sections: NavSection[],
  pathname: string,
): NavItem | undefined {
  const href = activeHref(sections, pathname);
  if (!href) return undefined;
  return sections
    .flatMap((section) => section.items)
    .find((item) => hrefsOf(item).includes(href));
}
