import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Nfc } from "lucide-react";
import { toast } from "sonner";

import { getAccessAdmin, issueKey, revokeKey, saveDoor, type DoorKind } from "@/lib/keys.functions";
import { EmptyState, Kpi, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dateLong } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/passersystem")({
  head: () => ({ meta: [{ title: "Passersystem – Boendeplattformen" }] }),
  component: AccessAdminPage,
});

type Data = Awaited<ReturnType<typeof getAccessAdmin>>;
type Door = Data["doors"][number];
type Key = Data["keys"][number];

const doorKindLabels: Record<DoorKind, string> = {
  entrance: "Port",
  laundry: "Tvättstuga",
  garbage: "Soprum",
  garage: "Garage",
  bike: "Cykelrum",
  storage: "Förråd",
  common: "Gemensam lokal",
  other: "Övrigt",
};

const holderKindLabels: Record<string, string> = {
  resident: "Boende",
  staff: "Personal",
  contractor: "Entreprenör",
  guest: "Gäst",
};

const timeFormat = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function keyStatus(k: Key) {
  const now = Date.now();
  if (k.revoked_at) return { label: "Återkallad", tone: "neutral" as const };
  if (k.valid_until && new Date(k.valid_until).getTime() <= now)
    return { label: "Utgången", tone: "neutral" as const };
  if (new Date(k.valid_from).getTime() > now) return { label: "Kommande", tone: "info" as const };
  return { label: "Aktiv", tone: "success" as const };
}

type DoorDraft = {
  id?: string;
  name: string;
  location: string;
  kind: DoorKind;
  propertyId: string;
  residentsAccess: boolean;
  readerId: string;
  isOnline: boolean;
};

type KeyDraft = {
  holder: string; // userId eller "guest"
  holderName: string;
  holderKind: "resident" | "staff" | "contractor" | "guest";
  doorIds: string[];
  validUntil: string;
  note: string;
};

const NO_PROPERTY = "none";

function AccessAdminPage() {
  const fn = useServerFn(getAccessAdmin);
  const saveDoorFn = useServerFn(saveDoor);
  const issueFn = useServerFn(issueKey);
  const revokeFn = useServerFn(revokeKey);
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["access-admin"], queryFn: () => fn() });
  const [doorDraft, setDoorDraft] = useState<DoorDraft | null>(null);
  const [keyDraft, setKeyDraft] = useState<KeyDraft | null>(null);
  const [onlyDenied, setOnlyDenied] = useState(false);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["access-admin"] });

  const saveDoorM = useMutation({
    mutationFn: (d: DoorDraft) =>
      saveDoorFn({
        data: {
          ...(d.id ? { id: d.id } : {}),
          name: d.name,
          location: d.location,
          kind: d.kind,
          propertyId: d.propertyId === NO_PROPERTY ? null : d.propertyId,
          residentsAccess: d.residentsAccess,
          readerId: d.readerId,
          isOnline: d.isOnline,
        },
      }),
    onSuccess: () => {
      setDoorDraft(null);
      toast.success("Dörren är sparad");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const issueM = useMutation({
    mutationFn: (k: KeyDraft) =>
      issueFn({
        data: {
          userId: k.holder === "guest" ? null : k.holder,
          holderName: k.holderName,
          holderKind: k.holderKind,
          doorIds: k.doorIds,
          validUntil: k.validUntil ? new Date(k.validUntil).toISOString() : null,
          note: k.note,
        },
      }),
    onSuccess: () => {
      setKeyDraft(null);
      toast.success("Nyckeln är utfärdad");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeM = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Nyckeln är återkallad och slutar fungera direkt");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || !data) return <LoadingBlock rows={4} />;

  const doorName = (id: string) => data.doors.find((d) => d.id === id)?.name ?? "Borttagen dörr";
  const propertyName = (id: string | null) => data.properties.find((p) => p.id === id)?.name ?? "–";
  const weekAgo = Date.now() - 7 * 864e5;
  const recent = data.events.filter((e) => new Date(e.created_at).getTime() > weekAgo);
  const activeKeys = data.keys.filter((k) => keyStatus(k).label === "Aktiv");
  const events = onlyDenied ? data.events.filter((e) => e.result === "denied") : data.events;
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const copyLink = async (door: Door) => {
    const url = `${origin}/n/${door.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("NFC-länken är kopierad");
    } catch {
      toast.message(url);
    }
  };

  const editDoor = (d: Door) =>
    setDoorDraft({
      id: d.id,
      name: d.name,
      location: d.location ?? "",
      kind: (d.kind in doorKindLabels ? d.kind : "other") as DoorKind,
      propertyId: d.property_id ?? NO_PROPERTY,
      residentsAccess: d.residents_access,
      readerId: d.reader_id ?? "",
      isOnline: d.is_online,
    });

  return (
    <div>
      <PageHeader
        title="Passersystem"
        subtitle="Dörrar med NFC-läsare, digitala nycklar och passagelogg"
        action={
          data.canEdit ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  setDoorDraft({
                    name: "",
                    location: "",
                    kind: "entrance",
                    propertyId: data.properties[0]?.id ?? NO_PROPERTY,
                    residentsAccess: true,
                    readerId: "",
                    isOnline: true,
                  })
                }
              >
                Ny dörr
              </Button>
              <Button
                onClick={() =>
                  setKeyDraft({
                    holder: "guest",
                    holderName: "",
                    holderKind: "guest",
                    doorIds: [],
                    validUntil: "",
                    note: "",
                  })
                }
              >
                Utfärda nyckel
              </Button>
            </div>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Kpi
          label="Dörrar"
          value={data.doors.length}
          hint={`${data.doors.filter((d) => !d.is_online).length} offline`}
        />
        <Kpi label="Aktiva nycklar" value={activeKeys.length} hint="utöver boendes egna dörrar" />
        <Kpi label="Passager" value={recent.length} hint="senaste 7 dagarna" />
        <Kpi
          label="Nekade"
          value={recent.filter((e) => e.result === "denied").length}
          hint="senaste 7 dagarna"
        />
      </div>

      <div className="mt-5 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">
        <p className="flex items-center gap-2 font-medium">
          <Nfc className="size-4" /> Så fungerar det
        </p>
        <p className="mt-1">
          Varje dörr har en NFC-läsare. Boende öppnar sin port och gemensamma utrymmen med
          telefonen; entreprenörer och gäster får tidsbegränsade nycklar här. Vill ni prova själva:
          kopiera en dörrs NFC-länk och skriv den till en vanlig NFC-etikett (t.ex. med appen NFC
          Tools). När någon håller telefonen mot etiketten prövas behörigheten och passagen loggas –
          precis som med en riktig läsare.
        </p>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Dörrar">
          {data.doors.length === 0 ? (
            <EmptyState title="Inga dörrar ännu" />
          ) : (
            <ul className="divide-y divide-border">
              {data.doors.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doorKindLabels[d.kind as DoorKind] ?? d.kind} · {propertyName(d.property_id)}
                      {d.reader_id ? ` · läsare ${d.reader_id}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={d.residents_access ? "info" : "neutral"}>
                      {d.residents_access ? "Alla boende" : "Kräver nyckel"}
                    </StatusPill>
                    {!d.is_online ? <StatusPill tone="warning">Offline</StatusPill> : null}
                    <Button size="sm" variant="ghost" onClick={() => copyLink(d)}>
                      <Copy className="size-3.5" /> NFC-länk
                    </Button>
                    {data.canEdit ? (
                      <Button size="sm" variant="outline" onClick={() => editDoor(d)}>
                        Ändra
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Nycklar" description="Tidsbegränsade nycklar för entreprenörer och gäster">
          {data.keys.length === 0 ? (
            <EmptyState title="Inga nycklar utfärdade" />
          ) : (
            <ul className="divide-y divide-border">
              {data.keys.map((k) => {
                const status = keyStatus(k);
                return (
                  <li key={k.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium">{k.holder_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {holderKindLabels[k.holder_kind] ?? k.holder_kind} ·{" "}
                        {k.door_ids.map(doorName).join(", ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {k.valid_until ? `Gäller till ${dateLong(k.valid_until)}` : "Tills vidare"}
                        {k.note ? ` · ${k.note}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      {data.canEdit && status.label === "Aktiv" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={revokeM.isPending}
                          onClick={() => revokeM.mutate(k.id)}
                        >
                          Återkalla
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Passagelogg"
        className="mt-5"
        action={
          <Button size="sm" variant="outline" onClick={() => setOnlyDenied((v) => !v)}>
            {onlyDenied ? "Visa alla" : "Bara nekade"}
          </Button>
        }
      >
        {events.length === 0 ? (
          <EmptyState title="Inga passager" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Tid</th>
                  <th className="py-2 pr-3 font-medium">Dörr</th>
                  <th className="py-2 pr-3 font-medium">Vem</th>
                  <th className="py-2 pr-3 font-medium">Resultat</th>
                  <th className="py-2 font-medium">Orsak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.slice(0, 60).map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 pr-3 whitespace-nowrap tnum">
                      {timeFormat.format(new Date(e.created_at))}
                    </td>
                    <td className="py-2 pr-3">{doorName(e.door_id)}</td>
                    <td className="py-2 pr-3">{e.holder_name ?? "–"}</td>
                    <td className="py-2 pr-3">
                      <StatusPill tone={e.result === "granted" ? "success" : "danger"}>
                        {e.result === "granted" ? "Öppnad" : "Nekad"}
                      </StatusPill>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {e.reason}
                      {e.method === "nfc" ? " · NFC" : " · app"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog open={!!doorDraft} onOpenChange={(v) => !v && setDoorDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{doorDraft?.id ? "Ändra dörr" : "Ny dörr"}</DialogTitle>
          </DialogHeader>
          {doorDraft ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="door-name">Namn</Label>
                <Input
                  id="door-name"
                  value={doorDraft.name}
                  onChange={(e) => setDoorDraft({ ...doorDraft, name: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Typ</Label>
                  <Select
                    value={doorDraft.kind}
                    onValueChange={(v) => setDoorDraft({ ...doorDraft, kind: v as DoorKind })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(doorKindLabels).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fastighet</Label>
                  <Select
                    value={doorDraft.propertyId}
                    onValueChange={(v) => setDoorDraft({ ...doorDraft, propertyId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROPERTY}>Ingen</SelectItem>
                      {data.properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="door-location">Placering</Label>
                  <Input
                    id="door-location"
                    value={doorDraft.location}
                    onChange={(e) => setDoorDraft({ ...doorDraft, location: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="door-reader">Läsarens id</Label>
                  <Input
                    id="door-reader"
                    value={doorDraft.readerId}
                    placeholder="Från låsleverantören"
                    onChange={(e) => setDoorDraft({ ...doorDraft, readerId: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={doorDraft.residentsAccess}
                  onChange={(e) =>
                    setDoorDraft({ ...doorDraft, residentsAccess: e.target.checked })
                  }
                />
                Alla boende i fastigheten kommer in
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={doorDraft.isOnline}
                  onChange={(e) => setDoorDraft({ ...doorDraft, isOnline: e.target.checked })}
                />
                Läsaren är ansluten
              </label>
              <div className="flex justify-end pt-2">
                <Button
                  disabled={!doorDraft.name.trim() || saveDoorM.isPending}
                  onClick={() => saveDoorM.mutate(doorDraft)}
                >
                  {saveDoorM.isPending ? "Sparar…" : "Spara"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!keyDraft} onOpenChange={(v) => !v && setKeyDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Utfärda nyckel</DialogTitle>
          </DialogHeader>
          {keyDraft ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Vem</Label>
                <Select
                  value={keyDraft.holder}
                  onValueChange={(v) => {
                    const h = data.holders.find((x) => x.userId === v);
                    setKeyDraft({
                      ...keyDraft,
                      holder: v,
                      holderName: h ? h.name : "",
                      holderKind: h ? h.kind : "guest",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guest">Gäst eller hantverkare utan konto</SelectItem>
                    {data.holders.map((h) => (
                      <SelectItem key={h.userId} value={h.userId}>
                        {h.name} ({holderKindLabels[h.kind]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {keyDraft.holder === "guest" ? (
                <div className="space-y-2">
                  <Label htmlFor="key-holder">Namn</Label>
                  <Input
                    id="key-holder"
                    value={keyDraft.holderName}
                    placeholder="T.ex. Hemtjänsten eller Flyttfirma AB"
                    onChange={(e) => setKeyDraft({ ...keyDraft, holderName: e.target.value })}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Dörrar</Label>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {data.doors.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={keyDraft.doorIds.includes(d.id)}
                        onChange={(e) =>
                          setKeyDraft({
                            ...keyDraft,
                            doorIds: e.target.checked
                              ? [...keyDraft.doorIds, d.id]
                              : keyDraft.doorIds.filter((x) => x !== d.id),
                          })
                        }
                      />
                      {d.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="key-until">Gäller till</Label>
                <Input
                  id="key-until"
                  type="datetime-local"
                  value={keyDraft.validUntil}
                  onChange={(e) => setKeyDraft({ ...keyDraft, validUntil: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Lämna tomt för tills vidare.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="key-note">Anteckning</Label>
                <Textarea
                  id="key-note"
                  rows={2}
                  value={keyDraft.note}
                  onChange={(e) => setKeyDraft({ ...keyDraft, note: e.target.value })}
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  disabled={
                    !keyDraft.holderName.trim() || keyDraft.doorIds.length === 0 || issueM.isPending
                  }
                  onClick={() => issueM.mutate(keyDraft)}
                >
                  {issueM.isPending ? "Utfärdar…" : "Utfärda nyckel"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
