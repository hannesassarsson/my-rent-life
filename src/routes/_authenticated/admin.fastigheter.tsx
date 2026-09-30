import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { getAdminProperties, getAdminUnits, updateUnit } from "@/lib/app.functions";
import {
  createUnit,
  deleteBuilding,
  deleteProperty,
  deleteUnit,
  saveBuilding,
  saveProperty,
} from "@/lib/manage.functions";
import { PageHeader, Panel, Kpi, LoadingBlock, EmptyState } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { kr } from "@/lib/format";
import { useCan } from "@/lib/use-can";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { errorMessage } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/admin/fastigheter")({
  component: AdminProperties,
});

type Data = Awaited<ReturnType<typeof getAdminProperties>>;
type Property = Data["properties"][number];
type Building = Data["buildings"][number];

type PropertyDraft = {
  id?: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  buildYear: string;
};

type BuildingDraft = { id?: string; propertyId: string; name: string; floors: string };

type NewUnitDraft = {
  buildingId: string;
  unitNumber: string;
  objectNumber: string;
  address: string;
  floor: string;
  sizeSqm: string;
  rooms: string;
  tenure: "owned" | "rented";
  monthlyAmount: string;
};

/** "" → null, annars ett tal (NaN om det inte går att tolka). */
function numOrNull(value: string) {
  const v = value.trim().replace(",", ".").replace(/\s/g, "");
  return v === "" ? null : Number(v);
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["admin-properties"] });
    void qc.invalidateQueries({ queryKey: ["admin-units"] });
  };
}

function AdminProperties() {
  const propFn = useServerFn(getAdminProperties);
  const unitFn = useServerFn(getAdminUnits);
  const { data, isPending } = useQuery({ queryKey: ["admin-properties"], queryFn: () => propFn() });
  const { data: units } = useQuery({ queryKey: ["admin-units"], queryFn: () => unitFn() });
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Unit | null>(null);
  const [property, setProperty] = useState<PropertyDraft | null>(null);
  const [building, setBuilding] = useState<BuildingDraft | null>(null);
  const [newUnit, setNewUnit] = useState<NewUnitDraft | null>(null);
  const can = useCan();
  const canEdit = can("properties.edit");

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
  const unitsIn = (buildingId: string) => data.units.filter((u) => u.building_id === buildingId);

  const startNewUnit = (b: Building) => {
    const p = data.properties.find((x) => x.id === b.property_id);
    setNewUnit({
      buildingId: b.id,
      unitNumber: "",
      objectNumber: "",
      address: p?.address ?? "",
      floor: "",
      sizeSqm: "",
      rooms: "",
      tenure: "owned",
      monthlyAmount: "",
    });
  };

  return (
    <div>
      <PageHeader
        title="Fastigheter"
        subtitle={`${data.properties.length} fastigheter · ${data.buildings.length} hus · ${totalUnits} lägenheter`}
        action={
          canEdit ? (
            <Button
              onClick={() =>
                setProperty({
                  name: "",
                  address: "",
                  postalCode: "",
                  city: "",
                  buildYear: "",
                })
              }
            >
              Ny fastighet
            </Button>
          ) : undefined
        }
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
          <TabsTrigger value="properties">Fastigheter och hus</TabsTrigger>
          <TabsTrigger value="units">Lägenheter</TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="mt-5 space-y-5">
          {data.properties.length === 0 ? (
            <EmptyState
              title="Inga fastigheter ännu"
              description="Lägg till föreningens första fastighet. Därefter kan du lägga till hus och lägenheter."
            />
          ) : null}
          {data.properties.map((p) => {
            const buildings = data.buildings.filter((b) => b.property_id === p.id);
            const unitCount = buildings.reduce((s, b) => s + unitsIn(b.id).length, 0);
            return (
              <Panel
                key={p.id}
                title={p.address}
                description={[
                  p.name !== p.address ? p.name : null,
                  [p.postal_code, p.city].filter(Boolean).join(" ") || null,
                  p.build_year ? `byggår ${p.build_year}` : null,
                  `${unitCount} lägenheter`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                action={
                  canEdit ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setProperty(propertyDraft(p))}
                    >
                      Ändra
                    </Button>
                  ) : undefined
                }
              >
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {buildings.map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="text-sm font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {unitsIn(b.id).length} lägenheter
                          {b.floors ? ` · ${b.floors} våningar` : ""}
                        </p>
                      </div>
                      {canEdit ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => startNewUnit(b)}>
                            <Plus className="size-4" aria-hidden />
                            Lägenhet
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setBuilding({
                                id: b.id,
                                propertyId: b.property_id,
                                name: b.name,
                                floors: b.floors != null ? String(b.floors) : "",
                              })
                            }
                          >
                            Ändra
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                  {buildings.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-muted-foreground">Inga hus ännu.</li>
                  ) : null}
                </ul>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-3"
                    onClick={() => setBuilding({ propertyId: p.id, name: "", floors: "" })}
                  >
                    <Plus className="size-4" aria-hidden />
                    Nytt hus
                  </Button>
                ) : null}
              </Panel>
            );
          })}
        </TabsContent>

        <TabsContent value="units" className="mt-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Sök adress eller lägenhet…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            {canEdit && data.buildings.length > 0 ? (
              <Button variant="outline" onClick={() => startNewUnit(data.buildings[0]!)}>
                <Plus className="size-4" aria-hidden />
                Ny lägenhet
              </Button>
            ) : null}
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
                      {canEdit ? <th className="px-5 py-3" /> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUnits.slice(0, 120).map((u) => (
                      <tr key={u.id}>
                        <td className="px-5 py-3">{u.address}</td>
                        <td className="px-3 py-3">{u.unit_number}</td>
                        <td className="px-3 py-3 tnum">
                          {u.size_sqm != null ? `${Number(u.size_sqm)} m²` : "–"}
                        </td>
                        <td className="px-3 py-3 tnum">
                          {u.rooms != null ? Number(u.rooms) : "–"}
                        </td>
                        <td className="px-3 py-3">
                          {u.tenure === "rented" ? "Hyresrätt" : "Bostadsrätt"}
                        </td>
                        <td className="px-3 py-3">
                          <StatusPill tone={u.status === "active" ? "success" : "warning"}>
                            {unitStatusLabels[u.status] ?? u.status}
                          </StatusPill>
                        </td>
                        <td className="px-5 py-3 text-right tnum">{kr(u.monthly_amount)}</td>
                        {canEdit ? (
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
      <PropertyDialog
        draft={property}
        setDraft={setProperty}
        hasUnits={
          !!property?.id &&
          data.buildings.some((b) => b.property_id === property.id && unitsIn(b.id).length > 0)
        }
      />
      <BuildingDialog
        draft={building}
        setDraft={setBuilding}
        hasUnits={!!building?.id && unitsIn(building.id).length > 0}
      />
      <NewUnitDialog
        draft={newUnit}
        setDraft={setNewUnit}
        buildings={data.buildings}
        properties={data.properties}
      />
    </div>
  );
}

function propertyDraft(p: Property): PropertyDraft {
  return {
    id: p.id,
    name: p.name,
    address: p.address,
    postalCode: p.postal_code ?? "",
    city: p.city ?? "",
    buildYear: p.build_year != null ? String(p.build_year) : "",
  };
}

/* ------------------------------ FASTIGHET ------------------------------ */

function PropertyDialog({
  draft,
  setDraft,
  hasUnits,
}: {
  draft: PropertyDraft | null;
  setDraft: (d: PropertyDraft | null) => void;
  hasUnits: boolean;
}) {
  const saveFn = useServerFn(saveProperty);
  const deleteFn = useServerFn(deleteProperty);
  const invalidate = useInvalidate();
  const [confirm, setConfirm] = useState(false);

  const year = draft ? numOrNull(draft.buildYear) : null;
  const yearInvalid = year !== null && (!Number.isInteger(year) || year < 1600 || year > 2200);

  const save = useMutation({
    mutationFn: (d: PropertyDraft) =>
      saveFn({
        data: {
          ...(d.id ? { id: d.id } : {}),
          name: d.name.trim() || d.address.trim(),
          address: d.address,
          postalCode: d.postalCode,
          city: d.city,
          buildYear: year,
        },
      }),
    onSuccess: (_r, d) => {
      toast.success(d.id ? "Fastigheten är sparad" : "Fastigheten är skapad med ett första hus");
      setDraft(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (propertyId: string) => deleteFn({ data: { id: propertyId } }),
    onSuccess: () => {
      toast.success("Fastigheten är borttagen");
      setConfirm(false);
      setDraft(null);
      invalidate();
    },
    onError: (e: Error) => {
      setConfirm(false);
      toast.error(errorMessage(e));
    },
  });

  return (
    <>
      <Dialog open={!!draft} onOpenChange={(v) => !v && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Ändra fastighet" : "Ny fastighet"}</DialogTitle>
            {!draft?.id ? (
              <DialogDescription>
                Fastigheten får ett första hus med samma adress. Fler hus kan läggas till efteråt.
              </DialogDescription>
            ) : null}
          </DialogHeader>
          {draft ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="prop-address">Gatuadress</Label>
                <Input
                  id="prop-address"
                  placeholder="t.ex. Storgatan 12"
                  value={draft.address}
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prop-name">Fastighetsbeteckning eller namn (valfritt)</Label>
                <Input
                  id="prop-name"
                  placeholder="t.ex. Solrosen 4"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="prop-postal">Postnummer</Label>
                  <Input
                    id="prop-postal"
                    inputMode="numeric"
                    value={draft.postalCode}
                    onChange={(e) => setDraft({ ...draft, postalCode: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-city">Ort</Label>
                  <Input
                    id="prop-city"
                    value={draft.city}
                    onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-year">Byggår</Label>
                  <Input
                    id="prop-year"
                    inputMode="numeric"
                    value={draft.buildYear}
                    aria-invalid={yearInvalid}
                    onChange={(e) => setDraft({ ...draft, buildYear: e.target.value })}
                  />
                </div>
              </div>
              <Button
                className="w-full"
                disabled={!draft.address.trim() || yearInvalid || save.isPending}
                onClick={() => save.mutate(draft)}
              >
                {save.isPending ? "Sparar…" : draft.id ? "Spara fastigheten" : "Skapa fastigheten"}
              </Button>
              {draft.id ? (
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => setConfirm(true)}
                >
                  Ta bort fastigheten
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Ta bort ${draft?.address || "fastigheten"}?`}
        pending={remove.isPending}
        confirmLabel={hasUnits ? "Förstått" : "Ta bort"}
        destructive={!hasUnits}
        onConfirm={() => (hasUnits ? setConfirm(false) : draft?.id && remove.mutate(draft.id))}
        description={
          hasUnits ? (
            <p>
              Fastigheten har lägenheter och kan inte tas bort. Ta först bort eller flytta
              lägenheterna.
            </p>
          ) : (
            <p>Fastigheten och dess hus tas bort. Det går inte att ångra.</p>
          )
        }
      />
    </>
  );
}

/* --------------------------------- HUS --------------------------------- */

function BuildingDialog({
  draft,
  setDraft,
  hasUnits,
}: {
  draft: BuildingDraft | null;
  setDraft: (d: BuildingDraft | null) => void;
  hasUnits: boolean;
}) {
  const saveFn = useServerFn(saveBuilding);
  const deleteFn = useServerFn(deleteBuilding);
  const invalidate = useInvalidate();
  const [confirm, setConfirm] = useState(false);

  const floors = draft ? numOrNull(draft.floors) : null;
  const floorsInvalid = floors !== null && (!Number.isInteger(floors) || floors < 0);

  const save = useMutation({
    mutationFn: (d: BuildingDraft) =>
      saveFn({
        data: {
          ...(d.id ? { id: d.id } : {}),
          propertyId: d.propertyId,
          name: d.name,
          floors,
        },
      }),
    onSuccess: (_r, d) => {
      toast.success(d.id ? "Huset är sparat" : "Huset är skapat");
      setDraft(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (buildingId: string) => deleteFn({ data: { id: buildingId } }),
    onSuccess: () => {
      toast.success("Huset är borttaget");
      setConfirm(false);
      setDraft(null);
      invalidate();
    },
    onError: (e: Error) => {
      setConfirm(false);
      toast.error(errorMessage(e));
    },
  });

  return (
    <>
      <Dialog open={!!draft} onOpenChange={(v) => !v && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Ändra hus" : "Nytt hus"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                <div className="space-y-2">
                  <Label htmlFor="bld-name">Namn eller adress</Label>
                  <Input
                    id="bld-name"
                    placeholder="t.ex. Storgatan 12A eller Hus B"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bld-floors">Våningar</Label>
                  <Input
                    id="bld-floors"
                    inputMode="numeric"
                    value={draft.floors}
                    aria-invalid={floorsInvalid}
                    onChange={(e) => setDraft({ ...draft, floors: e.target.value })}
                  />
                </div>
              </div>
              <Button
                className="w-full"
                disabled={!draft.name.trim() || floorsInvalid || save.isPending}
                onClick={() => save.mutate(draft)}
              >
                {save.isPending ? "Sparar…" : draft.id ? "Spara huset" : "Skapa huset"}
              </Button>
              {draft.id ? (
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => setConfirm(true)}
                >
                  Ta bort huset
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Ta bort ${draft?.name || "huset"}?`}
        pending={remove.isPending}
        confirmLabel={hasUnits ? "Förstått" : "Ta bort"}
        destructive={!hasUnits}
        onConfirm={() => (hasUnits ? setConfirm(false) : draft?.id && remove.mutate(draft.id))}
        description={
          hasUnits ? (
            <p>Huset har lägenheter och kan inte tas bort. Ta först bort lägenheterna.</p>
          ) : (
            <p>Huset tas bort. Det går inte att ångra.</p>
          )
        }
      />
    </>
  );
}

/* ---------------------------- NY LÄGENHET ------------------------------ */

function NewUnitDialog({
  draft,
  setDraft,
  buildings,
  properties,
}: {
  draft: NewUnitDraft | null;
  setDraft: (d: NewUnitDraft | null) => void;
  buildings: Building[];
  properties: Property[];
}) {
  const createFn = useServerFn(createUnit);
  const invalidate = useInvalidate();

  const nums = draft
    ? {
        floor: numOrNull(draft.floor),
        sizeSqm: numOrNull(draft.sizeSqm),
        rooms: numOrNull(draft.rooms),
        monthlyAmount: numOrNull(draft.monthlyAmount),
      }
    : null;
  const invalid =
    !!nums && Object.values(nums).some((n) => n !== null && (!Number.isFinite(n) || n < -5));

  const create = useMutation({
    mutationFn: (d: NewUnitDraft) =>
      createFn({
        data: {
          buildingId: d.buildingId,
          unitNumber: d.unitNumber,
          objectNumber: d.objectNumber,
          address: d.address,
          floor: nums!.floor,
          sizeSqm: nums!.sizeSqm,
          rooms: nums!.rooms,
          tenure: d.tenure,
          monthlyAmount: nums!.monthlyAmount,
        },
      }),
    onSuccess: (_r, d) => {
      toast.success(`Lägenhet ${d.unitNumber} är skapad som ledig`);
      // Behåll huset och adressen, så att flera lägenheter kan läggas in i följd.
      setDraft({ ...d, unitNumber: "", objectNumber: "", floor: "", sizeSqm: "", rooms: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
  });

  const propertyName = (b: Building) =>
    properties.find((p) => p.id === b.property_id)?.address ?? "";

  const field = (key: keyof NewUnitDraft, label: string, placeholder = "") => (
    <div className="space-y-2">
      <Label htmlFor={`new-unit-${key}`}>{label}</Label>
      <Input
        id={`new-unit-${key}`}
        placeholder={placeholder}
        value={String(draft?.[key] ?? "")}
        onChange={(e) => draft && setDraft({ ...draft, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <Dialog open={!!draft} onOpenChange={(v) => !v && setDraft(null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ny lägenhet</DialogTitle>
          <DialogDescription>
            Lägenheten skapas som ledig. Flytta sedan in boende från lägenhetens sida.
          </DialogDescription>
        </DialogHeader>
        {draft ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Hus</Label>
              <Select
                value={draft.buildingId}
                onValueChange={(v) => setDraft({ ...draft, buildingId: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {buildings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                      {propertyName(b) && propertyName(b) !== b.name ? ` · ${propertyName(b)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {field("unitNumber", "Lägenhetsnummer", "t.ex. 1102")}
              {field("objectNumber", "Objektnummer (valfritt)")}
            </div>
            {field("address", "Adress")}
            <div className="grid gap-3 sm:grid-cols-3">
              {field("floor", "Våning")}
              {field("sizeSqm", "Yta (m²)")}
              {field("rooms", "Rum")}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Upplåtelseform</Label>
                <Select
                  value={draft.tenure}
                  onValueChange={(v) => setDraft({ ...draft, tenure: v as NewUnitDraft["tenure"] })}
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
              {field("monthlyAmount", "Månadsbelopp (kr)")}
            </div>
            {invalid ? <p className="text-sm text-destructive">Kontrollera sifferfälten.</p> : null}
            <Button
              className="w-full"
              disabled={
                !draft.unitNumber.trim() || !draft.address.trim() || invalid || create.isPending
              }
              onClick={() => create.mutate(draft)}
            >
              {create.isPending ? "Skapar…" : "Skapa lägenheten"}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------- ÄNDRA LÄGENHET ---------------------------- */

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
  const deleteFn = useServerFn(deleteUnit);
  const invalidate = useInvalidate();
  const [draft, setDraft] = useState<UnitDraft | null>(null);
  const [forId, setForId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

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

  const close = () => {
    setForId(null);
    onClose();
  };

  const save = useMutation({
    mutationFn: (d: UnitDraft) =>
      updateFn({
        data: {
          id: unit!.id,
          monthlyAmount: numOrNull(d.monthlyAmount),
          sizeSqm: numOrNull(d.sizeSqm),
          rooms: numOrNull(d.rooms),
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
      invalidate();
      close();
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (unitId: string) => deleteFn({ data: { id: unitId } }),
    onSuccess: () => {
      toast.success("Lägenheten är borttagen");
      setConfirm(false);
      invalidate();
      close();
    },
    onError: (e: Error) => {
      setConfirm(false);
      toast.error(errorMessage(e), { duration: 8000 });
    },
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
    <>
      <Dialog open={!!unit} onOpenChange={(v) => !v && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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
              <Button
                className="w-full"
                disabled={save.isPending}
                onClick={() => save.mutate(draft)}
              >
                {save.isPending ? "Sparar…" : "Spara lägenheten"}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => setConfirm(true)}
              >
                Ta bort lägenheten
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Ta bort lägenhet ${unit?.unit_number ?? ""}?`}
        pending={remove.isPending}
        onConfirm={() => unit && remove.mutate(unit.id)}
        description={
          <>
            <p>
              Bara lägenheter utan historik kan tas bort, till exempel en som lagts in av misstag.
              Har den haft boende, avgifter, ärenden eller dokument sparas den, och du kan i stället
              sätta status Ledig.
            </p>
          </>
        }
      />
    </>
  );
}
