import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { getAdminBookings, updateResource } from "@/lib/app.functions";
import { PageHeader, Panel, LoadingBlock, EmptyState } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { dateTime, resourceKindLabels } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
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
  slotMinutes: number;
  openFrom: string;
  openTo: string;
  maxActiveBookings: number;
  daysAhead: number;
  cancelHours: number;
  isActive: boolean;
};

function AdminBookings() {
  const fn = useServerFn(getAdminBookings);
  const updateFn = useServerFn(updateResource);
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["admin-bookings"], queryFn: () => fn() });
  const [rules, setRules] = useState<Rules | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const { name: _name, ...payload } = rules!;
      return updateFn({ data: payload });
    },
    onSuccess: async () => {
      toast.success("Reglerna är sparade");
      setRules(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
    onError: () => toast.error("Kunde inte spara reglerna"),
  });

  const bookingsFor = (id: string) =>
    (data?.bookings ?? []).filter((b) => b.resource_id === id).length;

  return (
    <div>
      <PageHeader title="Bokningar" subtitle="Resurser, regler och kommande bokningar" />

      {isPending ? (
        <LoadingBlock rows={5} />
      ) : (
        <div className="space-y-6">
          <Panel title="Bokningsbara resurser" padded={false}>
            {(data?.resources ?? []).length === 0 ? (
              <div className="p-5">
                <EmptyState title="Inga resurser" />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data!.resources.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {resourceKindLabels[r.kind as string] ?? r.kind} ·{" "}
                        {String(r.open_from).slice(0, 5)}–{String(r.open_to).slice(0, 5)} ·{" "}
                        {r.slot_minutes} min · max {r.max_active_bookings} aktiva ·{" "}
                        {r.days_ahead} dagar framåt
                      </p>
                    </div>
                    <StatusPill tone="info">{bookingsFor(r.id)} bokningar</StatusPill>
                    <StatusPill tone={r.is_active ? "success" : "neutral"}>
                      {r.is_active ? "Aktiv" : "Avstängd"}
                    </StatusPill>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setRules({
                          id: r.id,
                          name: r.name,
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
                      Regler
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Kommande bokningar" padded={false}>
            {(data?.bookings ?? []).length === 0 ? (
              <div className="p-5">
                <EmptyState title="Inga bokningar" />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data!.bookings.slice(0, 60).map((b) => {
                  const resource = data!.resources.find((r) => r.id === b.resource_id);
                  return (
                    <li key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{resource?.name ?? "Resurs"}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {b.booked_by_name ?? "—"}
                          {b.units ? ` · ${b.units.address} ${b.units.unit_number}` : ""}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground tnum">
                        {dateTime(b.starts_at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      )}

      <Dialog open={rules !== null} onOpenChange={(v) => !v && setRules(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rules?.name}</DialogTitle>
          </DialogHeader>
          {rules ? (
            <div className="grid gap-3 sm:grid-cols-2">
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
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 sm:col-span-2">
                <Label htmlFor="active">Resursen är bokningsbar</Label>
                <Switch
                  id="active"
                  checked={rules.isActive}
                  onCheckedChange={(v) => setRules({ ...rules, isActive: v })}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              Spara regler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
