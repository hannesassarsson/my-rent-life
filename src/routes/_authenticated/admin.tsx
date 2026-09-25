import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wrench,
  Building2,
  Users,
  Wallet,
  CalendarCheck,
  Megaphone,
  HardHat,
  Hammer,
  Settings,
  MessageSquare,
  CalendarDays,
  FileText,
  ClipboardCheck,
} from "lucide-react";

import { AppShell, type NavItem } from "@/components/app-shell";

const items: NavItem[] = [
  { label: "Översikt", to: "/admin", icon: LayoutDashboard, permission: "overview" },
  { label: "Ärenden", to: "/admin/arenden", icon: Wrench, permission: "requests.view" },
  {
    label: "Fastigheter",
    to: "/admin/fastigheter",
    icon: Building2,
    permission: "properties.view",
  },
  {
    label: "Boende",
    to: "/admin/boende",
    icon: Users,
    permission: "residents.view",
    term: "residentPlural",
  },
  { label: "Ekonomi", to: "/admin/ekonomi", icon: Wallet, permission: "economy.view" },
  { label: "Bokningar", to: "/admin/bokningar", icon: CalendarCheck, permission: "bookings.edit" },
  {
    label: "Kommunikation",
    to: "/admin/kommunikation",
    icon: Megaphone,
    permission: "communication.edit",
  },
  {
    label: "Meddelanden",
    to: "/admin/meddelanden",
    icon: MessageSquare,
    permission: "messages.edit",
  },
  { label: "Möten", to: "/admin/moten", icon: CalendarDays, permission: "meetings.edit" },
  { label: "Dokument", to: "/admin/dokument", icon: FileText, permission: "documents.edit" },
  {
    label: "Entreprenörer",
    to: "/admin/entreprenorer",
    icon: HardHat,
    permission: "contractors.view",
  },
  {
    label: "Besiktningar",
    to: "/admin/besiktningar",
    icon: ClipboardCheck,
    permission: "inspections.view",
  },
  { label: "Underhållsplan", to: "/admin/underhall", icon: Hammer, permission: "maintenance.view" },
  {
    label: "Inställningar",
    to: "/admin/installningar",
    icon: Settings,
    permission: "settings.edit",
  },
];

export const Route = createFileRoute("/_authenticated/admin")({
  component: () => (
    <AppShell items={items} area="admin">
      <Outlet />
    </AppShell>
  ),
});
