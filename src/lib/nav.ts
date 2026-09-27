import {
  BarChart3,
  Bot,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  FlaskConical,
  Gauge,
  MessagesSquare,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

import { routes } from "@/lib/routes";
import type { AccountRole } from "@/lib/types/database";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Who the item is for. Defaults to everyone. */
  audience?: Audience;
};

type Audience = "coach" | "adept" | "all" | "admin";

export type NavSection = {
  /** Rendered above the group; omit for the primary group. */
  title?: string;
  items: NavItem[];
};

const allSections: NavSection[] = [
  {
    items: [
      { label: "Adepter", href: routes.adepts, icon: Users, audience: "coach" },
      {
        label: "Passbyggare",
        href: routes.workoutBuilder,
        icon: Dumbbell,
        // Adepter ser den också: som medlem bygger de egna pass, annars
        // visar sidan vad medlemskapet ger.
      },
      { label: "Planer", href: routes.plans, icon: ClipboardList },
      { label: "Testresultat", href: routes.testResults, icon: FlaskConical },
      { label: "Progression", href: routes.progression, icon: BarChart3 },
      { label: "Kalender", href: routes.calendar, icon: CalendarDays },
    ],
  },
  {
    title: "Verktyg",
    items: [
      {
        label: "Kalkyler",
        href: routes.calculators,
        icon: Gauge,
        audience: "coach",
      },
      {
        label: "AI Coach Assistant",
        href: routes.aiCoach,
        icon: Bot,
        audience: "coach",
      },
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
      { label: "Admin", href: routes.admin, icon: UserCog, audience: "admin" },
    ],
  },
];

/**
 * The menu an account should see. An adept has no roster of their own, so the
 * Adepter entry is a coach-only item rather than a link into an empty page.
 */
export function getNavSections(
  role: AccountRole | null,
  isAdmin = false,
): NavSection[] {
  return allSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          !item.audience ||
          item.audience === "all" ||
          item.audience === role ||
          (item.audience === "admin" && isAdmin),
      ),
    }))
    .filter((section) => section.items.length > 0);
}
