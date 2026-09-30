import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Link2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  getUnitDetail,
  moveResident,
  revokeInvitation,
  setPrimaryResident,
} from "@/lib/household.functions";
import { errorMessage } from "@/lib/errors";
import { dateLong, dateTime, kr, toDateInput } from "@/lib/format";
import { ResidentActions } from "@/components/resident-actions";
import {
  AccountStatusPill,
  AddResidentDialog,
  HouseholdRolePill,
  InviteDialog,
} from "@/components/household";
import { StatusPill } from "@/components/status-badge";
import { DataRow, EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/lagenheter/$id")({
  head: () => ({ meta: [{ title: "Lägenhet – Boendeplattformen" }] }),
  component: UnitPage,
});

type Detail = Awaited<ReturnType<typeof getUnitDetail>>;
type Resident = Detail["residents"][number];

const inviteStatusLabel: Record<string, { tone: "success" | "info" | "neutral"; text: string }> = {
  valid: { tone: "info", text: "Väntar på svar" },
  used: { tone: "success", text: "Använd" },
  revoked: { tone: "neutral", text: "Återkallad" },
  expired: { tone: "neutral", text: "Har gått ut" },
};

function UnitPage() {
  const { id } = Route.useParams();
  const fn = useServerFn(getUnitDetail);
  const primaryFn = useServerFn(setPrimaryResident);
  const revokeFn = useServerFn(revokeInvitation);
  const qc = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: ["unit-detail", id],
    queryFn: () => fn({ data: { id } }),
  });
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState<{ residency: Resident | null } | null>(null);
  const [moving, setMoving] = useState<Resident | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const refresh = () => {
    for (const key of ["unit-detail", "unit-registry", "admin-residents", "audit-log"]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };

  const makePrimary = useMutation({
    mutationFn: (r: Resident) => primaryFn({ data: { id: r.id } }),
    onSuccess: (_d, r) => {
      toast.success(`${r.resident_name} är nu primär boende`);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const revoke = useMutation({
    mutationFn: (inviteId: string) => revokeFn({ data: { id: inviteId } }),
    onSuccess: () => {
      toast.success("Inbjudan är återkallad. Länken fungerar inte längre.");
      setRevoking(null);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isPending) return <LoadingBlock rows={5} />;
  if (!data) {
    return (
      <EmptyState
        title="Lägenheten hittades inte"
        description={error ? errorMessage(error) : undefined}
        action={
          <Button variant="outline" asChild>
            <Link to="/admin/lagenheter">Till alla lägenheter</Link>
          </Button>
        }
      />
    );
  }

  const { unit } = data;
  const active = data.residents.filter((r) => r.status === "active");
  const former = data.residents.filter((r) => r.status !== "active");
  const pendingFor = new Set(
    data.invitations.filter((i) => i.status === "valid").map((i) => i.residency_id),
  );
  const property = unit.buildings?.properties;

  return (
    <div>
      <Link
        to="/admin/lagenheter"
        className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Alla lägenheter
      </Link>

      <PageHeader
        title={`Lägenhet ${unit.unit_number}`}
        subtitle={`${unit.address}${property?.city ? `, ${property.city}` : ""}`}
        action={
          data.canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setAdding(true)}>
                <UserPlus className="size-4" /> Lägg till boende
              </Button>
              <Button variant="outline" onClick={() => setInviting({ residency: null })}>
                <Link2 className="size-4" /> Skapa inbjudan
              </Button>
            </div>
          ) : null
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel
            title="Boende i lägenheten"
            description={
              active.length === 0
                ? "Ingen bor här just nu"
                : `${active.length} ${active.length === 1 ? "person" : "personer"} i hushållet`
            }
          >
            {active.length === 0 ? (
              <EmptyState
                title="Ingen boende registrerad"
                description="Lägg till den som bor här, eller skicka en inbjudan så lägger personen till sig själv."
                action={
                  data.canEdit ? (
                    <Button variant="outline" onClick={() => setAdding(true)}>
                      Lägg till boende
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="space-y-3">
                {active.map((r) => (
                  <li key={r.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold">{r.resident_name}</p>
                        <p className="mt-0.5 text-sm break-words text-muted-foreground">
                          {[r.email, r.phone].filter(Boolean).join(" · ") ||
                            "Inga kontaktuppgifter"}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          Inflyttad {dateLong(r.move_in_date)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <HouseholdRolePill primary={r.is_primary} />
                        <AccountStatusPill
                          status={r.status}
                          userId={r.user_id}
                          invited={pendingFor.has(r.id)}
                        />
                      </div>
                    </div>
                    {data.canEdit ? (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                        {!r.user_id ? (
                          <Button size="sm" onClick={() => setInviting({ residency: r })}>
                            <Link2 className="size-4" />
                            {pendingFor.has(r.id) ? "Skicka ny inbjudan" : "Bjud in"}
                          </Button>
                        ) : null}
                        {!r.is_primary ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={makePrimary.isPending}
                            onClick={() => makePrimary.mutate(r)}
                          >
                            Gör till primär boende
                          </Button>
                        ) : null}
                        <Button size="sm" variant="outline" onClick={() => setMoving(r)}>
                          Flytta till annan lägenhet
                        </Button>
                        <ResidentActions residency={r} size="sm" />
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/admin/boende/$id" params={{ id: r.id }}>
                            Mer om personen
                          </Link>
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {data.canEdit ? (
            <Panel
              title="Inbjudningar"
              description="Länkar som skickats till den här lägenheten"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setInviting({ residency: null })}
                >
                  Skapa inbjudan
                </Button>
              }
            >
              {data.invitations.length === 0 ? (
                <EmptyState
                  title="Inga inbjudningar ännu"
                  description="Skapa en inbjudan så kan den som bor här skapa ett konto själv."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {data.invitations.map((i) => {
                    const s = inviteStatusLabel[i.status] ?? inviteStatusLabel["expired"]!;
                    return (
                      <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {i.name ?? i.invitee_email ?? "Ny boende"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Skapad {dateTime(i.created_at)}
                            {i.sent_at ? " · skickad med e-post" : ""}
                            {i.status === "valid" ? ` · gäller till ${dateLong(i.expires_at)}` : ""}
                            {i.accepted_at ? ` · använd ${dateLong(i.accepted_at)}` : ""}
                          </p>
                        </div>
                        <StatusPill tone={s.tone}>{s.text}</StatusPill>
                        {i.status === "valid" ? (
                          <Button size="sm" variant="outline" onClick={() => setRevoking(i.id)}>
                            Återkalla
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          ) : null}

          {former.length > 0 ? (
            <Panel title="Tidigare boende">
              <ul className="divide-y divide-border">
                {former.map((r) => (
                  <li key={r.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                    <span className="font-medium">{r.resident_name}</span>
                    <span className="text-muted-foreground">
                      Utflyttad {r.move_out_date ? dateLong(r.move_out_date) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-5">
          <Panel title="Om lägenheten">
            <dl>
              <DataRow label="Lägenhetsnummer" value={unit.unit_number} />
              <DataRow label="Objektsnummer" value={unit.object_number ?? "–"} />
              <DataRow label="Hus" value={unit.buildings?.name ?? "–"} />
              <DataRow
                label="Storlek"
                value={unit.size_sqm ? `${Number(unit.size_sqm)} m²` : "–"}
              />
              <DataRow label="Rum" value={unit.rooms ? Number(unit.rooms) : "–"} />
              <DataRow label="Våning" value={unit.floor ?? "–"} />
              <DataRow
                label="Upplåtelse"
                value={unit.tenure === "rented" ? "Hyresrätt" : "Bostadsrätt"}
              />
              <DataRow label="Månadsbelopp" value={kr(unit.monthly_amount)} />
            </dl>
          </Panel>

          <Panel title="Historik" description="Ändringar för lägenheten">
            {data.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga ändringar registrerade ännu.</p>
            ) : (
              <ol className="space-y-3">
                {data.history.map((h) => (
                  <li key={h.id} className="text-sm">
                    <p>{h.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {dateTime(h.created_at)}
                      {h.actor_name ? ` · ${h.actor_name}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>

      <AddResidentDialog
        open={adding}
        onOpenChange={setAdding}
        unit={{
          id: unit.id,
          unit_number: unit.unit_number,
          address: unit.address,
          tenure: unit.tenure,
        }}
        unitHasResidents={() => active.length > 0}
      />
      {inviting ? (
        <InviteDialog
          open
          onOpenChange={(v) => !v && setInviting(null)}
          unit={unit}
          residency={inviting.residency}
          emailAvailable={data.emailAvailable}
        />
      ) : null}
      {moving ? (
        <MoveDialog
          resident={moving}
          units={data.otherUnits}
          onClose={() => setMoving(null)}
          onMoved={refresh}
        />
      ) : null}

      <AlertDialog open={!!revoking} onOpenChange={(v) => !v && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Återkalla inbjudan?</AlertDialogTitle>
            <AlertDialogDescription>
              Länken slutar fungera direkt. Du kan skapa en ny inbjudan när som helst.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Nej, behåll den</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (revoking) revoke.mutate(revoking);
              }}
            >
              {revoke.isPending ? "Återkallar…" : "Ja, återkalla"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MoveDialog({
  resident,
  units,
  onClose,
  onMoved,
}: {
  resident: Resident;
  units: { id: string; unit_number: string; address: string }[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const fn = useServerFn(moveResident);
  const [unitId, setUnitId] = useState("");
  const [date, setDate] = useState(toDateInput(new Date()));
  const target = units.find((u) => u.id === unitId);
  const move = useMutation({
    mutationFn: () => fn({ data: { id: resident.id, unitId, moveInDate: date } }),
    onSuccess: () => {
      toast.success(`${resident.resident_name} är flyttad till lägenhet ${target?.unit_number}`);
      onMoved();
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Flytta {resident.resident_name}</DialogTitle>
          <DialogDescription>
            Personen och ett eventuellt konto flyttas till den nya lägenheten. Flytten syns i
            historiken.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (unitId) move.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="move-unit">Ny lägenhet</Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger id="move-unit">
                <SelectValue placeholder="Välj lägenhet" />
              </SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.address} · lägenhet {u.unit_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="move-date">Inflyttningsdatum i nya lägenheten</Label>
            <Input
              id="move-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={!unitId || !date || move.isPending}>
            {move.isPending
              ? "Flyttar…"
              : target
                ? `Flytta till lägenhet ${target.unit_number}`
                : "Flytta"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
