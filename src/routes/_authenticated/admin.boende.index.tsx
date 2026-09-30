import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ChevronRight, Search, UserPlus } from "lucide-react";

import { getAdminResidents } from "@/lib/app.functions";
import { useOrgProfile } from "@/lib/use-org-profile";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { AccountStatusPill, AddResidentDialog, HouseholdRolePill } from "@/components/household";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/boende/")({
  head: () => ({ meta: [{ title: "Boende och konton – Boendeplattformen" }] }),
  component: AdminResidents,
});

type Filter = "all" | "active" | "invited" | "no_account" | "moved_out" | "no_home";

function AdminResidents() {
  const fn = useServerFn(getAdminResidents);
  const { profile } = useOrgProfile();
  const navigate = useNavigate();
  const { data, isPending } = useQuery({ queryKey: ["admin-residents"], queryFn: () => fn() });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);

  const residents = useMemo(() => data?.residents ?? [], [data]);
  const current = useMemo(() => residents.filter((r) => r.status === "active"), [residents]);
  const occupiedUnits = useMemo(() => new Set(current.map((r) => r.unit_id)), [current]);
  const counts = {
    all: current.length,
    active: current.filter((r) => r.user_id).length,
    invited:
      current.filter((r) => !r.user_id && r.invited).length +
      (data?.pendingInvitations.length ?? 0),
    no_account: current.filter((r) => !r.user_id && !r.invited).length,
    moved_out: residents.length - current.length,
    no_home: data?.accountsWithoutHome.length ?? 0,
  };

  const rows = useMemo(() => {
    const list = residents.filter((r) => {
      switch (filter) {
        case "all":
          return r.status === "active";
        case "active":
          return r.status === "active" && !!r.user_id;
        case "invited":
          return r.status === "active" && !r.user_id && r.invited;
        case "no_account":
          return r.status === "active" && !r.user_id && !r.invited;
        case "moved_out":
          return r.status !== "active";
        default:
          return false;
      }
    });
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((r) =>
      [r.resident_name, r.email, r.phone, r.units?.unit_number, r.units?.address]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [residents, q, filter]);

  const filters: [Filter, string][] = [
    ["all", `Alla boende (${counts.all})`],
    ["active", `Har konto (${counts.active})`],
    ["invited", `Inbjudna (${counts.invited})`],
    ["no_account", `Saknar konto (${counts.no_account})`],
    ["no_home", `Konto utan lägenhet (${counts.no_home})`],
    ["moved_out", `Utflyttade (${counts.moved_out})`],
  ];

  return (
    <div>
      <PageHeader
        title={profile.residentPlural}
        subtitle="Alla som bor i föreningen, deras lägenhet och om de har ett konto."
        action={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                aria-label="Sök boende"
                placeholder="Sök namn, e-post eller lägenhet"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            {data?.canEdit ? (
              <Button onClick={() => setAdding(true)} disabled={!data.units.length}>
                <UserPlus className="size-4" /> Lägg till boende
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Visa">
        {filters.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              "min-h-10 rounded-full border border-border px-4 text-sm transition hover:border-primary",
              filter === value && "border-primary bg-accent font-medium",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isPending || !data ? (
        <LoadingBlock rows={6} />
      ) : filter === "no_home" ? (
        <AccountsWithoutHome accounts={data.accountsWithoutHome} />
      ) : (
        <>
          {filter === "invited" && data.pendingInvitations.length > 0 ? (
            <Panel
              title="Inbjudna nya personer"
              description="Har fått en länk men inte skapat sitt konto ännu"
              className="mb-5"
              padded={false}
            >
              <ul className="divide-y divide-border">
                {data.pendingInvitations.map((i) => (
                  <li key={`${i.unit_id}-${i.created_at}`}>
                    <Link
                      to="/admin/lagenheter/$id"
                      params={{ id: i.unit_id }}
                      className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-surface-muted"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {i.invitee_name ?? i.invitee_email ?? "Ny boende"}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {i.unit ? `${i.unit.address} · lägenhet ${i.unit.unit_number}` : ""}
                        </p>
                      </div>
                      <StatusPill tone="info">Inbjuden</StatusPill>
                      <ChevronRight className="size-5 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
          {rows.length === 0 ? (
            <EmptyState
              title={q ? "Ingen matchar sökningen" : "Ingen här just nu"}
              description={
                q ? "Sök på en del av namnet, e-postadressen eller lägenhetsnumret." : undefined
              }
            />
          ) : (
            <Panel padded={false}>
              <ul className="divide-y divide-border">
                {rows.slice(0, 500).map((r) => (
                  <li key={r.id}>
                    <Link
                      to="/admin/boende/$id"
                      params={{ id: r.id }}
                      className="flex min-h-16 flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted"
                    >
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="truncate text-base font-medium">{r.resident_name}</p>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {r.units ? `Lägenhet ${r.units.unit_number} · ${r.units.address}` : ""}
                          {r.email ? ` · ${r.email}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {r.status === "active" ? (
                          <HouseholdRolePill primary={r.is_primary} />
                        ) : null}
                        <AccountStatusPill
                          status={r.status}
                          userId={r.user_id}
                          invited={r.invited}
                        />
                      </div>
                      <ChevronRight className="hidden size-5 text-muted-foreground sm:block" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}

      {data?.canEdit ? (
        <AddResidentDialog
          open={adding}
          onOpenChange={setAdding}
          units={data.units}
          unitHasResidents={(id) => occupiedUnits.has(id)}
          onAdded={(id) => void navigate({ to: "/admin/boende/$id", params: { id } })}
        />
      ) : null}
    </div>
  );
}

function AccountsWithoutHome({
  accounts,
}: {
  accounts: { id: string; full_name: string | null; email: string | null }[];
}) {
  if (accounts.length === 0) {
    return (
      <EmptyState
        title="Alla konton är kopplade till en lägenhet"
        description="Här visas konton med rollen boende som inte hör till någon lägenhet."
      />
    );
  }
  return (
    <Panel
      title="Konton utan lägenhet"
      description="Koppla kontot genom att skicka en inbjudan från rätt lägenhet till personens e-post."
      padded={false}
    >
      <ul className="divide-y divide-border">
        {accounts.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.full_name ?? "–"}</p>
              <p className="truncate text-sm text-muted-foreground">{a.email}</p>
            </div>
            <StatusPill tone="warning">Saknar lägenhet</StatusPill>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
