import {
  BarChart3,
  Bot,
  CalendarDays,
  ClipboardList,
  FlaskConical,
  MessagesSquare,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { routes } from "@/lib/routes";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavSection = {
  /** Rendered above the group; omit for the primary group. */
  title?: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    items: [
      { label: "Adepter", href: routes.adepts, icon: Users },
      { label: "Planer", href: routes.plans, icon: ClipboardList },
      { label: "Testresultat", href: routes.testResults, icon: FlaskConical },
      { label: "Progression", href: routes.progression, icon: BarChart3 },
      { label: "Kalender", href: routes.calendar, icon: CalendarDays },
    ],
  },
  {
    title: "Verktyg",
    items: [
      { label: "AI Coach Assistant", href: routes.aiCoach, icon: Bot },
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
