import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  cancelInspection,
  completeInspection,
  getAdminInspections,
  saveInspection,
  type InspectionKind,
  type InspectionResult,
} from "@/lib/app.functions";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { InspectionStatusPill } from "@/components/status-badge";
import { dateLong, inspectionKindLabels, inspectionResultLabels } from "@/lib/format";
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

export const Route = createFileRoute("/_authenticated/admin/besiktningar")({
  head: () => ({ meta: [{ title: "Besiktningar – Boendeplattformen" }] }),
  component: AdminInspectionsPage,
});

type Data = Awaited<ReturnType<typeof getAdminInspections>>;
type Inspection = Data["inspections"][number];

const WHOLE_PROPERTY = "property";

type PlanDraft = {
  id?: string;
  kind: InspectionKind;
  propertyId: string;
  unitId: string;
  scheduledAt: string;
  inspectorName: string;
  note: string;
};

type ProtocolDraft = {
  id: string;
  title: string;
  result: InspectionResult;
  inspectorName: string;
  protocol: string;
};

/** ISO-tid till värde för <input type="datetime-local"> i lokal tid. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const time = new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit" });

const kindLabel = (kind: string) =>
  inspectionKindLabels[kind as InspectionKind] ?? inspectionKindLabels.other;

function target(i: Inspection) {
  if (i.units) return `Lägenhet ${i.units.unit_number} · ${i.units.address}`;
  return `${i.properties?.name ?? "Fastigheten"} · hela fastigheten`;
}

function AdminInspectionsPage() {
  const fn = useServerFn(getAdminInspections);
  const saveFn = useServerFn(saveInspection);
  const completeFn = useServerFn(completeInspection);
  const cancelFn = useServerFn(cancelInspection);
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["admin-inspections"], queryFn: () => fn() });
  const [plan, setPlan] = useState<PlanDraft | null>(null);
  const [protocol, setProtocol] = useState<ProtocolDraft | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-inspections"] });
    void qc.invalidateQueries({ queryKey: ["my-home"] });
  };

  const save = useMutation({
    mutationFn: (d: PlanDraft) =>
      saveFn({
        data: {
          ...(d.id ? { id: d.id } : {}),
          kind: d.kind,
          propertyId: d.propertyId,
          unitId: d.unitId === WHOLE_PROPERTY ? null : d.unitId,
          scheduledAt: new Date(d.scheduledAt).toISOString(),
          inspectorName: d.inspectorName,
          note: d.note,
        },
      }),
    onSuccess: () => {
      setPlan(null);
      toast.success("Besiktningen är planerad och de boende har aviserats");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const complete = useMutation({
    mutationFn: (d: ProtocolDraft) =>
      completeFn({
        data: {
          id: d.id,
          result: d.result,
          inspectorName: d.inspectorName,
          protocol: d.protocol,
        },
      }),
    onSuccess: () => {
      setProtocol(null);
      toast.success("Protokollet är sparat");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => {
      setPlan(null);
      toast.success("Besiktningen är inställd");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || !data) return <LoadingBlock rows={4} />;

  const planned = data.inspections.filter((i) => i.status === "planned");
  const completed = data.inspections
    .filter((i) => i.status === "completed")
    .sort((a, b) => ((a.completed_at ?? "") > (b.completed_at ?? "") ? -1 : 1));
  const cancelled = data.inspections.filter((i) => i.status === "cancelled");
  const overdue = planned.filter(
    (i) => i.scheduled_at && new Date(i.scheduled_at).getTime() < Date.now(),
  ).length;

  const newPlan = (): PlanDraft => ({
    kind: "periodic",
    propertyId: data.properties[0]?.id ?? "",
    unitId: WHOLE_PROPERTY,
    scheduledAt: "",
    inspectorName: "",
    note: "",
  });

  const editPlan = (i: Inspection) =>
    setPlan({
      id: i.id,
      kind: (i.kind in inspectionKindLabels ? i.kind : "other") as InspectionKind,
      propertyId:
        i.property_id ??
        data.units.find((u) => u.id === i.unit_id)?.propertyId ??
        data.properties[0]?.id ??
        "",
      unitId: i.unit_id ?? WHOLE_PROPERTY,
      scheduledAt: i.scheduled_at ? toLocalInput(i.scheduled_at) : "",
      inspectorName: i.inspector_name ?? "",
      note: i.note ?? "",
    });

  const openProtocol = (i: Inspection) =>
    setProtocol({
      id: i.id,
      title: `${kindLabel(i.kind)} – ${target(i)}`,
      result: (i.result as InspectionResult | null) ?? "approved",
      inspectorName: i.inspector_name ?? "",
      protocol: i.protocol ?? "",
    });

  const unitsForProperty = plan ? data.units.filter((u) => u.propertyId === plan.propertyId) : [];

  return (
    <div>
      <PageHeader
        title="Besiktningar"
        subtitle="Planera besiktningar, avisera de boende och protokollför resultatet"
        action={
          data.canEdit ? (
            <Button onClick={() => setPlan(newPlan())}>Planera besiktning</Button>
          ) : null
        }
      />

      <div className="space-y-5">
        <Panel
          title="Planerade"
          description={
            overdue > 0
              ? `${overdue} ${overdue === 1 ? "besiktning har" : "besiktningar har"} passerat sin tid utan protokoll`
              : "De boende som berörs aviseras när en besiktning planeras"
          }
        >
          {planned.length === 0 ? (
            <EmptyState title="Inga planerade besiktningar" />
          ) : (
            <ul className="space-y-3">
              {planned.map((i) => {
                const late = i.scheduled_at && new Date(i.scheduled_at).getTime() < Date.now();
                return (
                  <li
                    key={i.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
                  >
                    <div>
                      <p className="text-sm font-medium">{kindLabel(i.kind)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {target(i)}
                        {i.scheduled_at
                          ? ` · ${dateLong(i.scheduled_at)} ${time.format(new Date(i.scheduled_at))}`
                          : ""}
                        {i.inspector_name ? ` · ${i.inspector_name}` : ""}
                      </p>
                      {late ? (
                        <p className="mt-1 text-xs font-medium text-warning-foreground">
                          Tiden har passerat – protokollför resultatet
                        </p>
                      ) : null}
                    </div>
                    {data.canEdit ? (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => editPlan(i)}>
                          Ändra
                        </Button>
                        <Button size="sm" onClick={() => openProtocol(i)}>
                          Protokollför
                        </Button>
                      </div>
                    ) : (
                      <InspectionStatusPill status={i.status} result={i.result} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Genomförda" description="Protokollen visas för de boende som berörs">
          {completed.length === 0 ? (
            <EmptyState title="Inga genomförda besiktningar" />
          ) : (
            <ul className="space-y-3">
              {completed.map((i) => (
                <li key={i.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{kindLabel(i.kind)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {target(i)} · {dateLong(i.completed_at ?? i.scheduled_at)}
                        {i.inspector_name ? ` · ${i.inspector_name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <InspectionStatusPill status={i.status} result={i.result} />
                      {data.canEdit ? (
                        <Button size="sm" variant="outline" onClick={() => openProtocol(i)}>
                          Redigera
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {i.protocol ? (
                    <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
                      {i.protocol}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {cancelled.length > 0 ? (
          <Panel title="Inställda">
            <ul className="space-y-2 text-sm text-muted-foreground">
              {cancelled.map((i) => (
                <li key={i.id}>
                  {kindLabel(i.kind)} · {target(i)}
                  {i.scheduled_at ? ` · ${dateLong(i.scheduled_at)}` : ""}
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>

      <Dialog open={!!plan} onOpenChange={(v) => !v && setPlan(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{plan?.id ? "Ändra besiktning" : "Planera besiktning"}</DialogTitle>
          </DialogHeader>
          {plan ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Typ</Label>
                  <Select
                    value={plan.kind}
                    onValueChange={(v) => setPlan({ ...plan, kind: v as InspectionKind })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(inspectionKindLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inspection-time">Tid</Label>
                  <Input
                    id="inspection-time"
                    type="datetime-local"
                    value={plan.scheduledAt}
                    onChange={(e) => setPlan({ ...plan, scheduledAt: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fastighet</Label>
                  <Select
                    value={plan.propertyId}
                    onValueChange={(v) =>
                      setPlan({ ...plan, propertyId: v, unitId: WHOLE_PROPERTY })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Välj fastighet" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Lägenhet</Label>
                  <Select
                    value={plan.unitId}
                    onValueChange={(v) => setPlan({ ...plan, unitId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={WHOLE_PROPERTY}>Hela fastigheten</SelectItem>
                      {unitsForProperty.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inspector">Besiktningsman eller firma</Label>
                <Input
                  id="inspector"
                  value={plan.inspectorName}
                  onChange={(e) => setPlan({ ...plan, inspectorName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inspection-note">Information till de boende</Label>
                <Textarea
                  id="inspection-note"
                  rows={3}
                  value={plan.note}
                  placeholder="T.ex. hur lång tid det tar och om man behöver vara hemma."
                  onChange={(e) => setPlan({ ...plan, note: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap justify-between gap-2 pt-2">
                {plan.id ? (
                  <Button
                    variant="outline"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate(plan.id!)}
                  >
                    Ställ in besiktningen
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  disabled={!plan.propertyId || !plan.scheduledAt || save.isPending}
                  onClick={() => save.mutate(plan)}
                >
                  {save.isPending
                    ? "Sparar…"
                    : plan.id
                      ? "Spara och avisera"
                      : "Planera och avisera"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!protocol} onOpenChange={(v) => !v && setProtocol(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Protokoll</DialogTitle>
          </DialogHeader>
          {protocol ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{protocol.title}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Resultat</Label>
                  <Select
                    value={protocol.result}
                    onValueChange={(v) =>
                      setProtocol({ ...protocol, result: v as InspectionResult })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(inspectionResultLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="protocol-inspector">Besiktningsman</Label>
                  <Input
                    id="protocol-inspector"
                    value={protocol.inspectorName}
                    onChange={(e) => setProtocol({ ...protocol, inspectorName: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="protocol-text">Anmärkningar och åtgärder</Label>
                <Textarea
                  id="protocol-text"
                  rows={6}
                  value={protocol.protocol}
                  placeholder="Vad som kontrollerades, anmärkningar och vad som ska åtgärdas."
                  onChange={(e) => setProtocol({ ...protocol, protocol: e.target.value })}
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button disabled={complete.isPending} onClick={() => complete.mutate(protocol)}>
                  {complete.isPending ? "Sparar…" : "Spara protokoll"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
