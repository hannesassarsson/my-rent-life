import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { getAdminProperties, getAdminUnits, updateUnit } from "@/lib/app.functions";
import { PageHeader, Panel, Kpi, LoadingBlock, EmptyState } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { kr } from "@/lib/format";
import { useCan } from "@/lib/use-can";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/fastigheter")({
  component: AdminProperties,
});

function AdminProperties() {
  const propFn = useServerFn(getAdminProperties);
  const unitFn = useServerFn(getAdminUnits);
  const { data, isPending } = useQuery({ queryKey: ["admin-properties"], queryFn: () => propFn() });
  const { data: units } = useQuery({ queryKey: ["admin-units"], queryFn: () => unitFn() });
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Unit | null>(null);
  const can = useCan();

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
                      <th className="px-3 py-3 text-left font-medium">Status</th>
                      <th className="px-5 py-3 text-right font-medium">Månadsbelopp</th>
                      {can("properties.edit") ? <th className="px-5 py-3" /> : null}
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
                        <td className="px-3 py-3">
                          <StatusPill tone={u.status === "active" ? "success" : "warning"}>
                            {unitStatusLabels[u.status] ?? u.status}
                          </StatusPill>
                        </td>
                        <td className="px-5 py-3 text-right tnum">{kr(u.monthly_amount)}</td>
                        {can("properties.edit") ? (
                          <td className="px-5 py-3 text-right">
                            <Button size="sm" variant="outline" onClick={() => setEditing(u)}>
                              Redigera
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </TabsContent>
      </Tabs>

      <UnitDialog unit={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

type Unit = Awaited<ReturnType<typeof getAdminUnits>>[number];

const unitStatusLabels: Record<string, string> = {
  active: "Uthyrd",
  vacant: "Ledig",
  renovation: "Renovering",
};

type UnitDraft = {
  monthlyAmount: string;
  sizeSqm: string;
  rooms: string;
  tenure: "owned" | "rented";
  status: "active" | "vacant" | "renovation";
  storage: string;
  parking: string;
  keyCount: string;
  balcony: boolean;
};

function UnitDialog({ unit, onClose }: { unit: Unit | null; onClose: () => void }) {
  const updateFn = useServerFn(updateUnit);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<UnitDraft | null>(null);
  const [forId, setForId] = useState<string | null>(null);

  if (unit && forId !== unit.id) {
    setForId(unit.id);
    setDraft({
      monthlyAmount: String(unit.monthly_amount ?? ""),
      sizeSqm: String(unit.size_sqm ?? ""),
      rooms: String(unit.rooms ?? ""),
      tenure: unit.tenure,
      status: (unit.status in unitStatusLabels ? unit.status : "active") as UnitDraft["status"],
      storage: unit.storage ?? "",
      parking: unit.parking ?? "",
      keyCount: String(unit.key_count),
      balcony: unit.balcony,
    });
  }

  const save = useMutation({
    mutationFn: (d: UnitDraft) =>
      updateFn({
        data: {
          id: unit!.id,
          monthlyAmount: Number(d.monthlyAmount),
          sizeSqm: Number(d.sizeSqm),
          rooms: Number(d.rooms),
          tenure: d.tenure,
          status: d.status,
          storage: d.storage,
          parking: d.parking,
          keyCount: Number(d.keyCount),
          balcony: d.balcony,
        },
      }),
    onSuccess: () => {
      toast.success("Lägenheten är sparad");
      void qc.invalidateQueries({ queryKey: ["admin-units"] });
      void qc.invalidateQueries({ queryKey: ["admin-properties"] });
      setForId(null);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const field = (key: keyof UnitDraft, label: string, type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={`unit-${key}`}>{label}</Label>
      <Input
        id={`unit-${key}`}
        type={type}
        value={String(draft?.[key] ?? "")}
        onChange={(e) => setDraft(draft ? { ...draft, [key]: e.target.value } : draft)}
      />
    </div>
  );

  return (
    <Dialog
      open={!!unit}
      onOpenChange={(v) => {
        if (!v) {
          setForId(null);
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {unit ? `${unit.address} · lägenhet ${unit.unit_number}` : "Lägenhet"}
          </DialogTitle>
        </DialogHeader>
        {draft ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              {field("monthlyAmount", "Månadsbelopp (kr)", "number")}
              {field("sizeSqm", "Yta (m²)", "number")}
              {field("rooms", "Rum", "number")}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={(v) => setDraft({ ...draft, status: v as UnitDraft["status"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(unitStatusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Upplåtelseform</Label>
                <Select
                  value={draft.tenure}
                  onValueChange={(v) => setDraft({ ...draft, tenure: v as UnitDraft["tenure"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owned">Bostadsrätt</SelectItem>
                    <SelectItem value="rented">Hyresrätt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {field("storage", "Förråd")}
              {field("parking", "Parkering")}
            </div>
            <div className="grid items-end gap-3 sm:grid-cols-2">
              {field("keyCount", "Antal nycklar", "number")}
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Checkbox
                  checked={draft.balcony}
                  onCheckedChange={(v) => setDraft({ ...draft, balcony: v === true })}
                />
                Balkong
              </label>
            </div>
            <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate(draft)}>
              {save.isPending ? "Sparar…" : "Spara"}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
