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
  { label: "Översikt", to: "/admin", icon: LayoutDashboard },
  { label: "Ärenden", to: "/admin/arenden", icon: Wrench },
  { label: "Fastigheter", to: "/admin/fastigheter", icon: Building2 },
  { label: "Boende", to: "/admin/boende", icon: Users },
  { label: "Ekonomi", to: "/admin/ekonomi", icon: Wallet },
  { label: "Bokningar", to: "/admin/bokningar", icon: CalendarCheck },
  { label: "Kommunikation", to: "/admin/kommunikation", icon: Megaphone },
  { label: "Entreprenörer", to: "/admin/entreprenorer", icon: HardHat },
  { label: "Underhållsplan", to: "/admin/underhall", icon: Hammer },
  { label: "Inställningar", to: "/admin/installningar", icon: Settings },
];

export const Route = createFileRoute("/_authenticated/admin")({
  component: () => (
    <AppShell items={items} area="admin">
      <Outlet />
    </AppShell>
  ),
});
