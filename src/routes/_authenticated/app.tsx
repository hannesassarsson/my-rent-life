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
  { label: "Översikt", to: "/app", icon: LayoutDashboard },
  { label: "Mitt boende", to: "/app/boende", icon: Home, term: "homeLabel" },
  { label: "Felanmälan", to: "/app/felanmalan", icon: Wrench },
  { label: "Bokningar", to: "/app/bokningar", icon: CalendarDays },
  { label: "Nycklar", to: "/app/nycklar", icon: KeyRound, feature: "keys" },
  { label: "Information", to: "/app/information", icon: Megaphone },
  { label: "Dokument", to: "/app/dokument", icon: FileText },
  { label: "Möten", to: "/app/moten", icon: Users, term: "meetingsLabel", feature: "meetings" },
  {
    label: "Ekonomi",
    to: "/app/ekonomi",
    icon: CreditCard,
    term: "feeWordLong",
    feature: "economy",
  },
  { label: "Meddelanden", to: "/app/meddelanden", icon: MessageSquare },
];

export const Route = createFileRoute("/_authenticated/app")({
  component: () => (
    <AppShell items={items} area="resident">
      <Outlet />
    </AppShell>
  ),
});
