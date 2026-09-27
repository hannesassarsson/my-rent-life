import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Menu, LogOut, ArrowLeftRight, Lock, UserRound, ChevronDown } from "lucide-react";

import { getMe } from "@/lib/app.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui-kit";
import { NotificationBell } from "@/components/notification-bell";
import { ROLE_LABELS, type Permission } from "@/lib/permissions";
import { orgProfileFor, type OrgTerm } from "@/lib/org-profile";
import { PLANS, type Feature } from "@/lib/plans";
import { Logo } from "@/components/brand";

export { Logo };

export type NavItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Behörighet som krävs för att se menyvalet och sidan. */
  permission?: Permission;
  /** Ord från organisationsprofilen som ersätter label (t.ex. Medlemmar/Hyresgäster). */
  term?: OrgTerm;
  /** Funktion som måste ingå i organisationens plan (boendes sidor). */
  feature?: Feature;
  /** Satt av skalet: rollen har behörighet men planen saknar funktionen. */
  locked?: boolean;
  /** Rubrik som menyvalet grupperas under. */
  group?: string;
  /** Mer sällan använda verktyg; visas hopfällda under "Fler verktyg". */
  advanced?: boolean;
};

export type Area = "resident" | "admin" | "contractor";

const AREA_HOME: Record<Area, string> = {
  resident: "/app",
  admin: "/admin",
  contractor: "/entreprenor",
};

const AREA_PROFILE = {
  resident: "/app/profil",
  admin: "/admin/profil",
  contractor: "/entreprenor/profil",
} as const satisfies Record<Area, string>;

const AREA_LABEL: Record<Area, string> = {
  resident: "Mitt boende",
  admin: "Administration",
  contractor: "Entreprenör",
};

function isActive(pathname: string, to: string) {
  return pathname === to || (!Object.values(AREA_HOME).includes(to) && pathname.startsWith(to));
}

export function meQueryOptions(fn: () => Promise<unknown>) {
  return { queryKey: ["me"], queryFn: fn };
}

const navLinkClass = (active: boolean) =>
  cn(
    "flex min-h-11 items-center gap-3 rounded-lg px-3 py-1.5 text-[0.9375rem] transition-colors lg:min-h-10",
    active
      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
      : "text-foreground/80 hover:bg-sidebar-accent/60 hover:text-foreground",
  );

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: (() => void) | undefined }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = isActive(pathname, item.to);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={navLinkClass(active)}
    >
      <Icon className="size-5 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.locked ? (
        <Lock className="size-4 text-muted-foreground" aria-label="Ingår inte i planen" />
      ) : null}
    </Link>
  );
}

/** Menyn i grupper med rubrik; sällan använda verktyg ligger hopfällda. */
function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const main = items.filter((i) => !i.advanced);
  const advanced = items.filter((i) => i.advanced);
  const advancedActive = advanced.some((i) => isActive(pathname, i.to));
  const [showAdvanced, setShowAdvanced] = useState(advancedActive);
  useEffect(() => {
    if (advancedActive) setShowAdvanced(true);
  }, [advancedActive]);

  const groups: { title: string | undefined; items: NavItem[] }[] = [];
  for (const item of main) {
    const last = groups[groups.length - 1];
    if (last && last.title === item.group) last.items.push(item);
    else groups.push({ title: item.group, items: [item] });
  }

  return (
    <nav aria-label="Huvudmeny" className="space-y-4">
      {groups.map((g, i) => (
        <div key={`${g.title ?? ""}-${i}`}>
          {g.title ? (
            <p className="mb-1.5 px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {g.title}
            </p>
          ) : null}
          <div className="space-y-0.5">
            {g.items.map((item) => (
              <NavLink key={item.to} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
      {advanced.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={(e) => {
              const button = e.currentTarget;
              setShowAdvanced((v) => !v);
              // Visa de utfällda valen även när menyn är längre än skärmen.
              requestAnimationFrame(() =>
                button.nextElementSibling?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
              );
            }}
            aria-expanded={showAdvanced}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left lg:min-h-10 text-[0.9375rem] text-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            <span className="flex-1 font-medium">
              {showAdvanced ? "Färre verktyg" : `Fler verktyg (${advanced.length})`}
            </span>
            <ChevronDown
              className={cn("size-5 transition-transform", showAdvanced && "rotate-180")}
            />
          </button>
          {showAdvanced ? (
            <div className="mt-0.5 space-y-0.5">
              {advanced.map((item) => (
                <NavLink key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}

/** Fast meny längst ned på mobilen med de vanligaste valen och "Meny". */
function BottomNav({ items, onOpenMenu }: { items: NavItem[]; onOpenMenu: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Snabbmeny"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div
        className="mx-auto grid max-w-lg"
        style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = isActive(pathname, item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-sm font-medium",
                active ? "text-primary" : "text-foreground/70",
              )}
            >
              <Icon className="size-6" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-sm font-medium text-foreground/70"
        >
          <Menu className="size-6" />
          <span>Meny</span>
        </button>
      </div>
    </nav>
  );
}

export function AppShell({
  items,
  area,
  mobileTabs = [],
  children,
}: {
  items: NavItem[];
  area: Area;
  /** Adresser som visas i mobilens fasta meny (om användaren har dem). */
  mobileTabs?: { to: string; label: string }[];
  children: React.ReactNode;
}) {
  const getMeFn = useServerFn(getMe);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const permissions: readonly string[] = me?.permissions ?? [];
  const planLocked: readonly string[] = me?.planLocked ?? [];
  const features: readonly string[] = me?.features ?? [];
  const orgProfile = orgProfileFor(me?.organization?.org_type);
  // Den boendes egen betalning följer lägenhetens upplåtelseform.
  const tenure = me?.residency?.tenure;
  const profile = tenure
    ? { ...orgProfile, feeWordLong: tenure === "rented" ? "Min hyra" : "Min avgift" }
    : orgProfile;
  const visibleItems = me
    ? items
        .filter(
          (item) =>
            (!item.permission ||
              permissions.includes(item.permission) ||
              planLocked.includes(item.permission)) &&
            (!item.feature || features.includes(item.feature)),
        )
        .map((item) => ({
          ...item,
          ...(item.term ? { label: profile[item.term] } : {}),
          locked: !!item.permission && planLocked.includes(item.permission),
        }))
    : [];
  const tabItems = mobileTabs.flatMap((t) => {
    const item = visibleItems.find((i) => i.to === t.to && !i.locked);
    return item ? [{ ...item, label: t.label }] : [];
  });
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
    !me ||
    ((!currentItem?.permission || permissions.includes(currentItem.permission)) &&
      (!currentItem?.feature || features.includes(currentItem.feature)));
  const lockedByPlan =
    !!me && !!currentItem?.permission && planLocked.includes(currentItem.permission);

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
    <div className="flex h-full flex-col gap-5 px-4 py-5">
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
        {area !== "resident" && me && me.roles.length > 0 ? (
          <p className="truncate text-xs text-muted-foreground">
            {me.profile?.full_name ? `${me.profile.full_name} · ` : ""}
            {me.roles.map((r) => ROLE_LABELS[r] ?? r).join(", ")}
          </p>
        ) : null}
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
        <Link
          to={AREA_PROFILE[area]}
          onClick={() => setOpen(false)}
          className={navLinkClass(pathname.startsWith(AREA_PROFILE[area]))}
        >
          <UserRound className="size-5 shrink-0" />
          Min profil
        </Link>
        {otherAreas.map((a) => (
          <Link
            key={a}
            to={AREA_HOME[a]}
            onClick={() => setOpen(false)}
            className={navLinkClass(false)}
          >
            <ArrowLeftRight className="size-5 shrink-0" />
            Byt till {AREA_LABEL[a].toLowerCase()}
          </Link>
        ))}
        <button type="button" onClick={signOut} className={cn(navLinkClass(false), "w-full")}>
          <LogOut className="size-5 shrink-0" />
          Logga ut
        </button>
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
          <SheetTrigger asChild className={cn(tabItems.length > 0 && "hidden")}>
            <Button variant="ghost" className="-ml-2 gap-2 px-2.5 text-base">
              <Menu className="size-6" />
              Meny
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] overflow-y-auto bg-sidebar p-0">
            <SheetTitle className="sr-only">Meny</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>
        <Logo />
        <NotificationBell />
      </header>

      <main className={cn("lg:pl-[270px]", tabItems.length > 0 && "pb-24 lg:pb-0")}>
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
          {area === "admin" && me ? (
            <BillingBanner
              access={me.access}
              trialEndsAt={me.trialEndsAt}
              canManage={permissions.includes("settings.edit")}
            />
          ) : null}
          {allowedHere ? (
            children
          ) : lockedByPlan ? (
            <UpgradeNotice
              feature={currentItem?.label ?? "Funktionen"}
              canManage={permissions.includes("settings.edit")}
            />
          ) : currentItem?.feature ? (
            <EmptyState
              title="Ingår inte i er plan"
              description="Er förening eller hyresvärd har inte den här delen i sitt abonnemang."
            />
          ) : (
            <EmptyState
              title="Behörighet saknas"
              description="Din roll har inte tillgång till den här sidan."
            />
          )}
        </div>
      </main>
      {tabItems.length > 0 ? <BottomNav items={tabItems} onOpenMenu={() => setOpen(true)} /> : null}
    </div>
  );
}

function daysUntil(iso: string | null) {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5));
}

/** Provperiod, misslyckad betalning eller skrivskyddat konto. */
function BillingBanner({
  access,
  trialEndsAt,
  canManage,
}: {
  access: "ok" | "trial" | "grace" | "locked";
  trialEndsAt: string | null;
  canManage: boolean;
}) {
  if (access === "ok") return null;
  const days = daysUntil(trialEndsAt);
  const text =
    access === "trial"
      ? `Provperiod: ${days === 1 ? "1 dag" : `${days} dagar`} kvar.`
      : access === "grace"
        ? "Den senaste betalningen gick inte igenom. Uppdatera betalningsuppgifterna för att undvika att kontot spärras."
        : "Kontot är skrivskyddat eftersom abonnemanget inte är betalt. Ni kan fortfarande läsa allt.";
  const tone =
    access === "trial"
      ? "border-info/30 bg-info-soft text-info"
      : access === "grace"
        ? "border-warning/40 bg-warning-soft text-warning-foreground"
        : "border-danger/30 bg-danger-soft text-danger";
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
        tone,
      )}
    >
      <span>{text}</span>
      {canManage ? (
        <Button size="sm" variant={access === "trial" ? "outline" : "default"} asChild>
          <Link to="/admin/abonnemang">
            {access === "trial" ? "Välj plan" : "Till abonnemanget"}
          </Link>
        </Button>
      ) : (
        <span className="text-xs opacity-80">Kontakta er administratör.</span>
      )}
    </div>
  );
}

function UpgradeNotice({ feature, canManage }: { feature: string; canManage: boolean }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
        <Lock className="size-5 text-muted-foreground" />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">
        {feature} ingår inte i ert abonnemang
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Lägg till det som ett tillägg, eller byt till {PLANS.standard.name} där de vanligaste
        tilläggen ingår.
      </p>
      {canManage ? (
        <Button className="mt-6" asChild>
          <Link to="/admin/abonnemang">Se tillägg och planer</Link>
        </Button>
      ) : (
        <p className="mt-6 text-xs text-muted-foreground">Kontakta er administratör.</p>
      )}
    </div>
  );
}
