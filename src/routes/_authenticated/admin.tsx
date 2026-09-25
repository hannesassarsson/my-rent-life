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
  { label: "Boende", to: "/admin/boende", icon: Users, permission: "residents.view" },
  { label: "Ekonomi", to: "/admin/ekonomi", icon: Wallet, permission: "economy.view" },
  { label: "Bokningar", to: "/admin/bokningar", icon: CalendarCheck, permission: "bookings.edit" },
  {
    label: "Kommunikation",
    to: "/admin/kommunikation",
    icon: Megaphone,
    permission: "communication.edit",
  },
  {
    label: "Entreprenörer",
    to: "/admin/entreprenorer",
    icon: HardHat,
    permission: "contractors.view",
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
