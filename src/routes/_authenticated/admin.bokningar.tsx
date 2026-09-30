import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { getAdminBookings, getAdminProperties, updateResource } from "@/lib/app.functions";
import {
  adminCancelBooking,
  createResource,
  deleteResource,
  type ResourceKind,
} from "@/lib/manage.functions";
import { PageHeader, Panel, LoadingBlock, EmptyState } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { dateShort, resourceKindLabels, timeRange } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/bokningar")({
  component: AdminBookings,
});

type Rules = {
  id: string;
  name: string;
  location: string;
  slotMinutes: number;
  openFrom: string;
  openTo: string;
  maxActiveBookings: number;
  daysAhead: number;
  cancelHours: number;
  isActive: boolean;
};

type NewResource = {
  name: string;
  kind: ResourceKind;
  location: string;
  propertyId: string | null;
};

const NO_PROPERTY = "__none__";
const ALL = "__all__";

type Data = Awaited<ReturnType<typeof getAdminBookings>>;
type Booking = Data["bookings"][number];

function AdminBookings() {
  const fn = useServerFn(getAdminBookings);
  const propFn = useServerFn(getAdminProperties);
  const updateFn = useServerFn(updateResource);
  const createFn = useServerFn(createResource);
  const deleteFn = useServerFn(deleteResource);
  const cancelFn = useServerFn(adminCancelBooking);
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["admin-bookings"], queryFn: () => fn() });
  const { data: props } = useQuery({ queryKey: ["admin-properties"], queryFn: () => propFn() });
  const [rules, setRules] = useState<Rules | null>(null);
  const [creating, setCreating] = useState<NewResource | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [reason, setReason] = useState("");
  const [resourceFilter, setResourceFilter] = useState(ALL);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });

  const save = useMutation({
    mutationFn: () => updateFn({ data: rules! }),
    onSuccess: async () => {
      toast.success("Resursen är sparad");
      setRules(null);
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const create = useMutation({
    mutationFn: (r: NewResource) =>
      createFn({
        data: {
          name: r.name,
          kind: r.kind,
          location: r.location,
          propertyId: r.propertyId,
        },
      }),
    onSuccess: async () => {
      toast.success("Resursen är skapad och går att boka");
      setCreating(null);
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (resourceId: string) => deleteFn({ data: { id: resourceId } }),
    onSuccess: async (res) => {
      toast.success(
        res.cancelled > 0
          ? `Resursen är borttagen. ${res.cancelled} bokningar avbokades och de som bokat har fått en notis.`
          : "Resursen är borttagen",
      );
      setConfirmDelete(false);
      setRules(null);
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: (b: Booking) =>
      cancelFn({ data: { id: b.id, ...(reason.trim() ? { reason: reason.trim() } : {}) } }),
    onSuccess: async () => {
      toast.success("Bokningen är avbokad och den som bokat har fått en notis");
      setCancelling(null);
      setReason("");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const now = Date.now();
  const upcoming = (data?.bookings ?? []).filter((b) => new Date(b.ends_at).getTime() >= now);
  const upcomingFor = (resourceId: string) =>
    upcoming.filter((b) => b.resource_id === resourceId).length;
  const shown = upcoming.filter((b) => resourceFilter === ALL || b.resource_id === resourceFilter);
  const resourceName = (resourceId: string) =>
    data?.resources.find((r) => r.id === resourceId)?.name ?? "Resurs";

  return (
    <div>
      <PageHeader
        title="Bokningar"
        subtitle="Resurser, regler och kommande bokningar"
        action={
          <Button
            onClick={() =>
              setCreating({ name: "", kind: "laundry", location: "", propertyId: null })
            }
          >
            Ny resurs
          </Button>
        }
      />

      {isPending ? (
        <LoadingBlock rows={5} />
      ) : (
        <div className="space-y-6">
          <Panel title="Bokningsbara resurser" padded={false}>
            {(data?.resources ?? []).length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="Inga resurser"
                  description="Lägg till tvättstuga, bastu, gästlägenhet eller annat som boende kan boka."
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data!.resources.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="truncate text-sm font-medium">
                        {r.icon ? `${r.icon} ` : ""}
                        {r.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {resourceKindLabels[r.kind] ?? r.kind}
                        {r.location ? ` · ${r.location}` : ""} · {String(r.open_from).slice(0, 5)}–
                        {String(r.open_to).slice(0, 5)} · {r.slot_minutes} min per pass · max{" "}
                        {r.max_active_bookings} aktiva · {r.days_ahead} dagar framåt
                      </p>
                    </div>
                    <StatusPill tone="info">{upcomingFor(r.id)} kommande</StatusPill>
                    <StatusPill tone={r.is_active ? "success" : "neutral"}>
                      {r.is_active ? "Bokningsbar" : "Avstängd"}
                    </StatusPill>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setRules({
                          id: r.id,
                          name: r.name,
                          location: r.location ?? "",
                          slotMinutes: r.slot_minutes,
                          openFrom: String(r.open_from).slice(0, 5),
                          openTo: String(r.open_to).slice(0, 5),
                          maxActiveBookings: r.max_active_bookings,
                          daysAhead: r.days_ahead,
                          cancelHours: r.cancel_hours,
                          isActive: r.is_active,
                        })
                      }
                    >
                      Ändra
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Kommande bokningar"
            padded={false}
            action={
              (data?.resources ?? []).length > 1 ? (
                <Select value={resourceFilter} onValueChange={setResourceFilter}>
                  <SelectTrigger className="h-9 w-44" aria-label="Visa bokningar för">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Alla resurser</SelectItem>
                    {data!.resources.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : undefined
            }
          >
            {shown.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Inga kommande bokningar" />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {shown.slice(0, 100).map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="truncate text-sm font-medium">{resourceName(b.resource_id)}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {b.booked_by_name ?? "—"}
                        {b.units ? ` · ${b.units.address} ${b.units.unit_number}` : ""}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground tnum">
                      {dateShort(b.starts_at)} · {timeRange(b.starts_at, b.ends_at)}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setCancelling(b)}>
                      Avboka
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {/* ÄNDRA RESURS */}
      <Dialog open={rules !== null} onOpenChange={(v) => !v && setRules(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ändra {rules?.name}</DialogTitle>
          </DialogHeader>
          {rules ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="res-name">Namn</Label>
                <Input
                  id="res-name"
                  value={rules.name}
                  onChange={(e) => setRules({ ...rules, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="res-location">Plats</Label>
                <Input
                  id="res-location"
                  placeholder="t.ex. Storgatan 12, källare"
                  value={rules.location}
                  onChange={(e) => setRules({ ...rules, location: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="from">Öppnar</Label>
                <Input
                  id="from"
                  type="time"
                  value={rules.openFrom}
                  onChange={(e) => setRules({ ...rules, openFrom: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="to">Stänger</Label>
                <Input
                  id="to"
                  type="time"
                  value={rules.openTo}
                  onChange={(e) => setRules({ ...rules, openTo: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="slot">Passlängd (min)</Label>
                <Input
                  id="slot"
                  type="number"
                  value={rules.slotMinutes}
                  onChange={(e) => setRules({ ...rules, slotMinutes: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="max">Max aktiva bokningar</Label>
                <Input
                  id="max"
                  type="number"
                  value={rules.maxActiveBookings}
                  onChange={(e) =>
                    setRules({ ...rules, maxActiveBookings: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label htmlFor="ahead">Dagar framåt</Label>
                <Input
                  id="ahead"
                  type="number"
                  value={rules.daysAhead}
                  onChange={(e) => setRules({ ...rules, daysAhead: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="cancel">Avbokning senast (timmar)</Label>
                <Input
                  id="cancel"
                  type="number"
                  value={rules.cancelHours}
                  onChange={(e) => setRules({ ...rules, cancelHours: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 sm:col-span-2">
                <div>
                  <Label htmlFor="active">Resursen är bokningsbar</Label>
                  <p className="text-xs text-muted-foreground">
                    Stäng av tillfälligt, till exempel vid reparation. Bokningarna finns kvar.
                  </p>
                </div>
                <Switch
                  id="active"
                  checked={rules.isActive}
                  onCheckedChange={(v) => setRules({ ...rules, isActive: v })}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              Ta bort resursen
            </Button>
            <Button disabled={save.isPending || !rules?.name.trim()} onClick={() => save.mutate()}>
              {save.isPending ? "Sparar…" : "Spara"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NY RESURS */}
      <Dialog open={creating !== null} onOpenChange={(v) => !v && setCreating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ny resurs</DialogTitle>
            <DialogDescription>
              Något som boende kan boka. Öppettider och regler kan ändras efteråt.
            </DialogDescription>
          </DialogHeader>
          {creating ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="new-name">Namn</Label>
                <Input
                  id="new-name"
                  placeholder="t.ex. Tvättstuga 3"
                  value={creating.name}
                  onChange={(e) => setCreating({ ...creating, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Typ</Label>
                <Select
                  value={creating.kind}
                  onValueChange={(v) => setCreating({ ...creating, kind: v as ResourceKind })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(resourceKindLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fastighet</Label>
                <Select
                  value={creating.propertyId ?? NO_PROPERTY}
                  onValueChange={(v) =>
                    setCreating({ ...creating, propertyId: v === NO_PROPERTY ? null : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROPERTY}>Alla fastigheter</SelectItem>
                    {(props?.properties ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="new-location">Plats</Label>
                <Input
                  id="new-location"
                  placeholder="t.ex. Storgatan 12, källare"
                  value={creating.location}
                  onChange={(e) => setCreating({ ...creating, location: e.target.value })}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              disabled={!creating?.name.trim() || create.isPending}
              onClick={() => creating && create.mutate(creating)}
            >
              {create.isPending ? "Skapar…" : "Skapa resursen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Ta bort ${rules?.name ?? "resursen"}?`}
        pending={remove.isPending}
        onConfirm={() => rules && remove.mutate(rules.id)}
        description={
          <>
            <p>Resursen och dess bokningshistorik tas bort. Det går inte att ångra.</p>
            {rules && upcomingFor(rules.id) > 0 ? (
              <p className="font-medium text-foreground">
                {upcomingFor(rules.id)} kommande bokningar avbokas, och de som bokat får en notis.
              </p>
            ) : null}
            <p>Vill du bara stänga den tillfälligt kan du i stället stänga av bokningen.</p>
          </>
        }
      />

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(v) => {
          if (!v) {
            setCancelling(null);
            setReason("");
          }
        }}
        title="Avboka bokningen?"
        confirmLabel="Avboka"
        cancelLabel="Behåll bokningen"
        pending={cancel.isPending}
        onConfirm={() => cancelling && cancel.mutate(cancelling)}
        description={
          cancelling ? (
            <>
              <p className="text-foreground">
                {resourceName(cancelling.resource_id)} · {dateShort(cancelling.starts_at)}{" "}
                {timeRange(cancelling.starts_at, cancelling.ends_at)}
                <br />
                {cancelling.booked_by_name ?? ""}
              </p>
              <p>Den som bokat får en notis om avbokningen.</p>
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="cancel-reason" className="text-foreground">
                  Anledning (valfritt)
                </Label>
                <Input
                  id="cancel-reason"
                  placeholder="t.ex. Tvättmaskinen är trasig"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </>
          ) : null
        }
      />
    </div>
  );
}
