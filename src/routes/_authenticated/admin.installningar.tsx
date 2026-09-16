import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getAdminSettings } from "@/lib/app.functions";
import { PageHeader, Panel, DataRow, LoadingBlock, EmptyState } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { dateLong } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/installningar")({
  component: AdminSettings,
});

const roleLabels: Record<string, string> = {
  super_admin: "Systemadmin",
  org_admin: "Organisationsadmin",
  property_manager: "Förvaltare",
  board_member: "Styrelse",
  staff: "Personal",
  contractor: "Entreprenör",
  resident: "Boende",
};

function AdminSettings() {
  const fn = useServerFn(getAdminSettings);
  const { data, isPending } = useQuery({ queryKey: ["admin-settings"], queryFn: () => fn() });

  return (
    <div>
      <PageHeader title="Inställningar" subtitle="Organisation, användare och roller" />

      {isPending ? (
        <LoadingBlock rows={4} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Panel title="Organisation">
            <dl>
              <DataRow label="Namn" value={data?.organization?.name ?? "—"} />
              <DataRow
                label="Typ"
                value={
                  data?.organization?.org_type === "rental"
                    ? "Hyresfastigheter"
                    : data?.organization?.org_type === "manager"
                      ? "Förvaltare"
                      : "Bostadsrättsförening"
                }
              />
              <DataRow label="Fastigheter" value={data?.propertyCount ?? 0} />
              <DataRow
                label="Skapad"
                value={
                  data?.organization?.created_at ? dateLong(data.organization.created_at) : "—"
                }
              />
            </dl>
          </Panel>

          <Panel
            title="Användare och roller"
            description={`${data?.members.length ?? 0} konton i organisationen`}
            padded={false}
          >
            {(data?.members ?? []).length === 0 ? (
              <div className="p-5">
                <EmptyState title="Inga konton ännu" />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data!.members.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.full_name ?? "—"}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{m.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {m.roles.length === 0 ? (
                        <StatusPill tone="warning">Ingen roll</StatusPill>
                      ) : (
                        m.roles.map((r) => (
                          <StatusPill key={r} tone="neutral">
                            {roleLabels[r] ?? r}
                          </StatusPill>
                        ))
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
