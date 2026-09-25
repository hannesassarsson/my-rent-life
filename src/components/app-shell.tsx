import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Menu, LogOut, ArrowLeftRight } from "lucide-react";

import { getMe } from "@/lib/app.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui-kit";
import { NotificationBell } from "@/components/notification-bell";
import { ROLE_LABELS, type Permission } from "@/lib/permissions";

export type NavItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Behörighet som krävs för att se menyvalet och sidan. */
  permission?: Permission;
};

export type Area = "resident" | "admin" | "contractor";

const AREA_HOME: Record<Area, string> = {
  resident: "/app",
  admin: "/admin",
  contractor: "/entreprenor",
};

const AREA_LABEL: Record<Area, string> = {
  resident: "Mitt boende",
  admin: "Administration",
  contractor: "Entreprenör",
};

function isActive(pathname: string, to: string) {
  return pathname === to || (!Object.values(AREA_HOME).includes(to) && pathname.startsWith(to));
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="grid size-8 place-items-center rounded-[10px] bg-primary text-primary-foreground">
        <span className="text-sm font-semibold">B</span>
      </span>
      <span className="text-[0.95rem] font-semibold tracking-tight">Boendeplattformen</span>
    </span>
  );
}

export function meQueryOptions(fn: () => Promise<unknown>) {
  return { queryKey: ["me"], queryFn: fn };
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="space-y-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  items,
  area,
  children,
}: {
  items: NavItem[];
  area: Area;
  children: React.ReactNode;
}) {
  const getMeFn = useServerFn(getMe);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const permissions: readonly string[] = me?.permissions ?? [];
  const visibleItems = me
    ? items.filter((item) => !item.permission || permissions.includes(item.permission))
    : [];
  const canUseArea =
    !me ||
    (area === "admin"
      ? permissions.length > 0
      : area === "contractor"
        ? me.roles.includes("contractor")
        : !!me.residency || me.home === "/app");
  const currentItem = [...items]
    .filter((item) => isActive(pathname, item.to))
    .sort((a, b) => b.to.length - a.to.length)[0];
  const allowedHere =
    !me || !currentItem?.permission || permissions.includes(currentItem.permission);

  // Skicka användaren till rätt del av appen om den inte hör hemma här.
  useEffect(() => {
    if (me && !canUseArea && me.home !== AREA_HOME[area]) navigate({ to: me.home, replace: true });
  }, [me, canUseArea, area, navigate]);

  const otherAreas = me
    ? (Object.keys(AREA_HOME) as Area[]).filter(
        (a) =>
          a !== area &&
          (a === "admin"
            ? permissions.length > 0
            : a === "contractor"
              ? me.roles.includes("contractor")
              : !!me.residency),
      )
    : [];

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <div className="flex items-center justify-between">
        <Link to="/" className="px-1">
          <Logo />
        </Link>
        <NotificationBell className="hidden lg:inline-flex" />
      </div>
      <div className="rounded-xl bg-surface-muted px-3 py-3">
        <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
          {AREA_LABEL[area]}
        </p>
        <p className="mt-1 truncate text-sm font-medium">{me?.organization?.name ?? "—"}</p>
        {area === "resident" && me?.residency?.units ? (
          <p className="truncate text-xs text-muted-foreground">
            {me.residency.units.address} · {me.residency.units.unit_number}
          </p>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavList items={visibleItems} onNavigate={() => setOpen(false)} />
      </div>
      <div className="space-y-1 border-t border-sidebar-border pt-4">
        {otherAreas.map((a) => (
          <Link
            key={a}
            to={AREA_HOME[a]}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            <ArrowLeftRight className="size-4" />
            Byt till {AREA_LABEL[a].toLowerCase()}
          </Link>
        ))}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          <LogOut className="size-4" />
          Logga ut
        </button>
        <div className="px-3 pt-2">
          <p className="truncate text-sm font-medium">{me?.profile?.full_name ?? "—"}</p>
          <p className="truncate text-xs text-muted-foreground">{me?.profile?.email}</p>
          {me && me.roles.length > 0 ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {me.roles.map((r) => ROLE_LABELS[r] ?? r).join(", ")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-[270px] border-r border-sidebar-border bg-sidebar lg:block">
        {sidebar}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-surface/85 px-4 py-3 backdrop-blur lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Meny">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] bg-sidebar p-0">
            <SheetTitle className="sr-only">Meny</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>
        <Logo />
        <NotificationBell />
      </header>

      <main className="lg:pl-[270px]">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
          {allowedHere ? (
            children
          ) : (
            <EmptyState
              title="Behörighet saknas"
              description="Din roll har inte tillgång till den här sidan."
            />
          )}
        </div>
      </main>
    </div>
  );
}
