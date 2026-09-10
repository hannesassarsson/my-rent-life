import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";

import { AppShell, type NavItem } from "@/components/app-shell";

const items: NavItem[] = [{ label: "Översikt", to: "/admin", icon: LayoutDashboard }];

export const Route = createFileRoute("/_authenticated/admin")({
  component: () => (
    <AppShell items={items} area="admin">
      <Outlet />
    </AppShell>
  ),
});
