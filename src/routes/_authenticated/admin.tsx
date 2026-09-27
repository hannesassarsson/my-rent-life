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
  CreditCard,
  DoorOpen,
  Plug,
} from "lucide-react";

import { AppShell, type NavItem } from "@/components/app-shell";

const DAILY = "Dagligt arbete";
const REGISTER = "Register och ekonomi";
const ORG = "Organisation";

const items: NavItem[] = [
  { label: "Översikt", to: "/admin", icon: LayoutDashboard, permission: "overview" },
  {
    label: "Ärenden",
    to: "/admin/arenden",
    icon: Wrench,
    permission: "requests.view",
    group: DAILY,
  },
  {
    label: "Meddelanden",
    to: "/admin/meddelanden",
    icon: MessageSquare,
    permission: "messages.edit",
    group: DAILY,
  },
  {
    label: "Nyheter till boende",
    to: "/admin/kommunikation",
    icon: Megaphone,
    permission: "communication.edit",
    group: DAILY,
  },
  {
    label: "Bokningar",
    to: "/admin/bokningar",
    icon: CalendarCheck,
    permission: "bookings.edit",
    group: DAILY,
  },
  {
    label: "Möten",
    to: "/admin/moten",
    icon: CalendarDays,
    permission: "meetings.edit",
    group: DAILY,
  },
  {
    label: "Dokument",
    to: "/admin/dokument",
    icon: FileText,
    permission: "documents.edit",
    group: DAILY,
  },
  {
    label: "Boende",
    to: "/admin/boende",
    icon: Users,
    permission: "residents.view",
    term: "residentPlural",
    group: REGISTER,
  },
  {
    label: "Fastigheter",
    to: "/admin/fastigheter",
    icon: Building2,
    permission: "properties.view",
    group: REGISTER,
  },
  {
    label: "Ekonomi",
    to: "/admin/ekonomi",
    icon: Wallet,
    permission: "economy.view",
    group: REGISTER,
  },
  {
    label: "Inställningar",
    to: "/admin/installningar",
    icon: Settings,
    permission: "settings.edit",
    group: ORG,
  },
  {
    label: "Abonnemang",
    to: "/admin/abonnemang",
    icon: CreditCard,
    permission: "settings.edit",
    group: ORG,
  },
  // Mer sällan använda verktyg, hopfällda under "Fler verktyg".
  {
    label: "Entreprenörer",
    to: "/admin/entreprenorer",
    icon: HardHat,
    permission: "contractors.view",
    advanced: true,
  },
  {
    label: "Besiktningar",
    to: "/admin/besiktningar",
    icon: ClipboardCheck,
    permission: "inspections.view",
    advanced: true,
  },
  {
    label: "Underhållsplan",
    to: "/admin/underhall",
    icon: Hammer,
    permission: "maintenance.view",
    advanced: true,
  },
  {
    label: "Passersystem",
    to: "/admin/passersystem",
    icon: DoorOpen,
    permission: "access.view",
    advanced: true,
  },
  {
    label: "Integrationer",
    to: "/admin/integrationer",
    icon: Plug,
    permission: "economy.edit",
    advanced: true,
  },
];

const mobileTabs = [
  { to: "/admin", label: "Översikt" },
  { to: "/admin/arenden", label: "Ärenden" },
  { to: "/admin/meddelanden", label: "Meddelanden" },
];

export const Route = createFileRoute("/_authenticated/admin")({
  component: () => (
    <AppShell items={items} area="admin" mobileTabs={mobileTabs}>
      <Outlet />
    </AppShell>
  ),
});
