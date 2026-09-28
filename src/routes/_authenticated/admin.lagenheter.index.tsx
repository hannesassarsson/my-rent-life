import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";

import { getUnitRegistry } from "@/lib/household.functions";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/lagenheter/")({
  head: () => ({ meta: [{ title: "Lägenheter – Boendeplattformen" }] }),
  component: UnitRegistry,
});

type Filter = "all" | "occupied" | "vacant" | "invited" | "no_account";

function UnitRegistry() {
  const fn = useServerFn(getUnitRegistry);
  const { data, isPending } = useQuery({ queryKey: ["unit-registry"], queryFn: () => fn() });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const all = data ?? [];
    return {
      all: all.length,
      occupied: all.filter((u) => u.residents.length > 0).length,
      vacant: all.filter((u) => u.residents.length === 0).length,
      invited: all.filter((u) => u.pendingInvitations > 0).length,
      no_account: all.filter((u) => u.residents.length > 0 && !u.residents.some((r) => r.account))
        .length,
    };
  }, [data]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((u) => {
      if (filter === "occupied" && u.residents.length === 0) return false;
      if (filter === "vacant" && u.residents.length > 0) return false;
      if (filter === "invited" && u.pendingInvitations === 0) return false;
      if (
        filter === "no_account" &&
        (u.residents.length === 0 || u.residents.some((r) => r.account))
      )
        return false;
      if (!needle) return true;
      return [u.unit_number, u.address, ...u.residents.map((r) => r.name)]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [data, q, filter]);

  const filters: [Filter, string][] = [
    ["all", `Alla (${counts.all})`],
    ["occupied", `Bebodda (${counts.occupied})`],
    ["vacant", `Lediga (${counts.vacant})`],
    ["no_account", `Ingen med konto (${counts.no_account})`],
    ["invited", `Väntande inbjudan (${counts.invited})`],
  ];

  return (
    <div>
      <PageHeader
        title="Lägenheter"
        subtitle="Klicka på en lägenhet för att se vilka som bor där, lägga till boende och skicka inbjudningar."
        action={
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              aria-label="Sök lägenhet eller namn"
              placeholder="Sök lägenhetsnummer, adress eller namn"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
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

      {isPending ? (
        <LoadingBlock rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={q ? "Ingen lägenhet matchar sökningen" : "Inga lägenheter här"}
          description={q ? "Kontrollera stavningen eller sök på lägenhetsnumret." : undefined}
        />
      ) : (
        <Panel padded={false}>
          <ul className="divide-y divide-border">
            {rows.slice(0, 300).map((u) => (
              <li key={u.id}>
                <Link
                  to="/admin/lagenheter/$id"
                  params={{ id: u.id }}
                  className="flex min-h-16 items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-muted"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-sm font-semibold text-primary tnum">
                    {u.unit_number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium">{u.address}</p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {u.residents.length === 0
                        ? "Ingen boende registrerad"
                        : u.residents.map((r) => r.name).join(", ")}
                    </p>
                  </div>
                  <div className="hidden flex-wrap justify-end gap-2 sm:flex">
                    {u.residents.length === 0 ? (
                      <StatusPill tone="neutral">Ledig</StatusPill>
                    ) : null}
                    {u.pendingInvitations > 0 ? (
                      <StatusPill tone="info">Inbjudan skickad</StatusPill>
                    ) : null}
                    {u.residents.length > 0 && !u.residents.some((r) => r.account) ? (
                      <StatusPill tone="warning">Inget konto</StatusPill>
                    ) : null}
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
