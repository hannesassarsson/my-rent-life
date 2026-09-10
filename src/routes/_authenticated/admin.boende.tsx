import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { getAdminResidents } from "@/lib/app.functions";
import { PageHeader, Panel, LoadingBlock, EmptyState } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { dateLong } from "@/lib/format";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/boende")({
  component: AdminResidents,
});

function AdminResidents() {
  const fn = useServerFn(getAdminResidents);
  const { data, isPending } = useQuery({ queryKey: ["admin-residents"], queryFn: () => fn() });
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const all = data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((r) =>
      [r.resident_name, r.email, r.units?.unit_number, r.units?.address]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [data, q]);

  return (
    <div>
      <PageHeader
        title="Boende"
        subtitle={data ? `${data.length} boende i registret` : undefined}
        action={
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Sök namn, e-post, lägenhet…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        }
      />

      {isPending ? (
        <LoadingBlock rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState title="Inga boende matchar sökningen" />
      ) : (
        <Panel padded={false}>
          <ul className="divide-y divide-border">
            {rows.slice(0, 150).map((r) => (
              <li key={r.id}>
                <Link
                  to="/admin/boende/$id"
                  params={{ id: r.id }}
                  className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.resident_name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {r.units?.address} · {r.units?.unit_number} · inflytt{" "}
                      {dateLong(r.move_in_date)}
                    </p>
                  </div>
                  <span className="hidden w-52 truncate text-xs text-muted-foreground sm:block">
                    {r.email ?? "—"}
                  </span>
                  <StatusPill tone={r.tenure === "rented" ? "info" : "neutral"}>
                    {r.tenure === "rented" ? "Hyresgäst" : "Medlem"}
                  </StatusPill>
                  <StatusPill tone={r.user_id ? "success" : "warning"}>
                    {r.user_id ? "Har konto" : "Inget konto"}
                  </StatusPill>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
