import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { getAdminRequests } from "@/lib/app.functions";
import { PageHeader, Panel, EmptyState, LoadingBlock } from "@/components/ui-kit";
import { PriorityBadge, RequestStatusBadge } from "@/components/status-badge";
import { dateTime, requestStatusLabels } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/arenden/")({
  component: AdminRequests,
});

const filters = [
  { key: "open", label: "Öppna" },
  { key: "urgent", label: "Akuta" },
  { key: "unassigned", label: "Ej tilldelade" },
  { key: "all", label: "Alla" },
] as const;

function AdminRequests() {
  const fn = useServerFn(getAdminRequests);
  const { data, isPending } = useQuery({ queryKey: ["admin-requests"], queryFn: () => fn() });
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("open");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const all = data ?? [];
    const byFilter = all.filter((r) => {
      const open = !["resolved", "closed"].includes(r.status as string);
      if (filter === "open") return open;
      if (filter === "urgent") return open && (r.is_urgent || r.priority === "urgent");
      if (filter === "unassigned") return open && !r.assignee_name && !r.contractors;
      return true;
    });
    const needle = q.trim().toLowerCase();
    if (!needle) return byFilter;
    return byFilter.filter((r) =>
      [r.title, r.category, r.units?.unit_number, r.units?.address, String(r.ticket_number)]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [data, filter, q]);

  return (
    <div>
      <PageHeader
        title="Ärenden"
        subtitle={data ? `${data.length} felanmälningar totalt` : undefined}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "secondary"}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Sök ärende, lägenhet…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {isPending ? (
        <LoadingBlock rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState title="Inga ärenden matchar filtret" />
      ) : (
        <Panel padded={false}>
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  to="/admin/arenden/$id"
                  params={{ id: r.id }}
                  className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-muted"
                >
                  <span className="w-14 text-xs text-muted-foreground tnum">
                    #{r.ticket_number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {r.category} · {r.units?.address ?? "—"} {r.units?.unit_number ?? ""} ·{" "}
                      {dateTime(r.created_at)}
                    </p>
                  </div>
                  <span className="hidden w-40 truncate text-xs text-muted-foreground sm:block">
                    {r.contractors?.company ?? r.assignee_name ?? "Ej tilldelat"}
                  </span>
                  <PriorityBadge priority={r.priority as string} />
                  <RequestStatusBadge status={r.status as string} />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Statusflöde: {Object.values(requestStatusLabels).join(" → ")}
      </p>
    </div>
  );
}
