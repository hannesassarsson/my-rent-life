import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";

import { AppShell, type NavItem } from "@/components/app-shell";

const items: NavItem[] = [{ label: "Mina uppdrag", to: "/entreprenor", icon: ClipboardList }];

export const Route = createFileRoute("/_authenticated/entreprenor")({
  component: () => (
    <AppShell items={items} area="contractor">
      <Outlet />
    </AppShell>
  ),
});
