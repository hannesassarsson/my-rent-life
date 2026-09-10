import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";

import { AppShell, type NavItem } from "@/components/app-shell";

const items: NavItem[] = [{ label: "Översikt", to: "/app", icon: LayoutDashboard }];

export const Route = createFileRoute("/_authenticated/app")({
  component: () => (
    <AppShell items={items} area="resident">
      <Outlet />
    </AppShell>
  ),
});
