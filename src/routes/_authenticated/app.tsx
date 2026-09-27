import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
  CalendarDays,
  CreditCard,
  FileText,
  Home,
  KeyRound,
  LayoutDashboard,
  MessageSquare,
  Megaphone,
  Users,
  Wrench,
} from "lucide-react";

import { AppShell, type NavItem } from "@/components/app-shell";

const items: NavItem[] = [
  { label: "Hem", to: "/app", icon: LayoutDashboard },
  { label: "Felanmälan", to: "/app/felanmalan", icon: Wrench, group: "Mitt boende" },
  { label: "Bokningar", to: "/app/bokningar", icon: CalendarDays, group: "Mitt boende" },
  {
    label: "Ekonomi",
    to: "/app/ekonomi",
    icon: CreditCard,
    term: "feeWordLong",
    feature: "economy",
    group: "Mitt boende",
  },
  {
    label: "Nycklar",
    to: "/app/nycklar",
    icon: KeyRound,
    feature: "keys",
    group: "Mitt boende",
  },
  {
    label: "Mitt boende",
    to: "/app/boende",
    icon: Home,
    term: "homeLabel",
    group: "Mitt boende",
  },
  { label: "Nyheter", to: "/app/information", icon: Megaphone, group: "Från föreningen" },
  { label: "Meddelanden", to: "/app/meddelanden", icon: MessageSquare, group: "Från föreningen" },
  { label: "Dokument", to: "/app/dokument", icon: FileText, group: "Från föreningen" },
  {
    label: "Möten",
    to: "/app/moten",
    icon: Users,
    term: "meetingsLabel",
    feature: "meetings",
    group: "Från föreningen",
  },
];

const mobileTabs = [
  { to: "/app", label: "Hem" },
  { to: "/app/felanmalan", label: "Felanmälan" },
  { to: "/app/bokningar", label: "Boka" },
];

export const Route = createFileRoute("/_authenticated/app")({
  component: () => (
    <AppShell items={items} area="resident" mobileTabs={mobileTabs}>
      <Outlet />
    </AppShell>
  ),
});
