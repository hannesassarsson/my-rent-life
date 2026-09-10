import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { getAdminProperties, getAdminUnits } from "@/lib/app.functions";
import { PageHeader, Panel, Kpi, LoadingBlock, EmptyState } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { kr } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/fastigheter")({
  component: AdminProperties,
});

function AdminProperties() {
  const propFn = useServerFn(getAdminProperties);
  const unitFn = useServerFn(getAdminUnits);
  const { data, isPending } = useQuery({ queryKey: ["admin-properties"], queryFn: () => propFn() });
  const { data: units } = useQuery({ queryKey: ["admin-units"], queryFn: () => unitFn() });
  const [q, setQ] = useState("");

  const filteredUnits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = units ?? [];
    if (!needle) return all;
    return all.filter((u) =>
      [u.address, u.unit_number, u.object_number].join(" ").toLowerCase().includes(needle),
    );
  }, [units, q]);

  if (isPending || !data) return <LoadingBlock rows={5} />;

  const totalUnits = data.units.length;
  const rented = data.units.filter((u) => u.tenure === "rented").length;
  const revenue = data.units.reduce((s, u) => s + Number(u.monthly_amount ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Fastigheter"
        subtitle={`${data.properties.length} fastigheter · ${data.buildings.length} hus · ${totalUnits} lägenheter`}
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <Kpi label="Lägenheter" value={totalUnits} hint={`${rented} hyresrätter`} />
        <Kpi label="Månadsintäkt" value={kr(revenue)} hint="avgifter och hyror" />
        <Kpi
          label="Vakanser"
          value={data.units.filter((u) => u.status !== "active").length}
          hint="ej aktiva objekt"
        />
      </div>

      <Tabs defaultValue="properties" className="mt-6">
        <TabsList>
          <TabsTrigger value="properties">Fastigheter</TabsTrigger>
          <TabsTrigger value="units">Lägenheter</TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="mt-5 space-y-5">
          {data.properties.map((p) => {
            const buildings = data.buildings.filter((b) => b.property_id === p.id);
            const unitCount = data.units.filter((u) =>
              buildings.some((b) => b.id === u.building_id),
            ).length;
            return (
              <Panel
                key={p.id}
                title={p.address}
                description={`${p.name} · ${p.postal_code ?? ""} ${p.city ?? ""} · byggår ${p.build_year ?? "—"}`}
              >
                <div className="flex flex-wrap gap-3">
                  <StatusPill tone="info">{unitCount} lägenheter</StatusPill>
                  {buildings.map((b) => (
                    <StatusPill key={b.id} tone="neutral">
                      {b.name} · {b.floors ?? "—"} vån
                    </StatusPill>
                  ))}
                </div>
              </Panel>
            );
          })}
        </TabsContent>

        <TabsContent value="units" className="mt-5">
          <div className="relative mb-4 w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Sök adress eller lägenhet…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {filteredUnits.length === 0 ? (
            <EmptyState title="Inga lägenheter matchar sökningen" />
          ) : (
            <Panel padded={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-surface-muted text-xs text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">Adress</th>
                      <th className="px-3 py-3 text-left font-medium">Lgh</th>
                      <th className="px-3 py-3 text-left font-medium">Yta</th>
                      <th className="px-3 py-3 text-left font-medium">Rum</th>
                      <th className="px-3 py-3 text-left font-medium">Form</th>
                      <th className="px-5 py-3 text-right font-medium">Månadsbelopp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUnits.slice(0, 120).map((u) => (
                      <tr key={u.id}>
                        <td className="px-5 py-3">{u.address}</td>
                        <td className="px-3 py-3">{u.unit_number}</td>
                        <td className="px-3 py-3 tnum">{Number(u.size_sqm)} m²</td>
                        <td className="px-3 py-3 tnum">{Number(u.rooms)}</td>
                        <td className="px-3 py-3">
                          {u.tenure === "rented" ? "Hyresrätt" : "Bostadsrätt"}
                        </td>
                        <td className="px-5 py-3 text-right tnum">{kr(u.monthly_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
