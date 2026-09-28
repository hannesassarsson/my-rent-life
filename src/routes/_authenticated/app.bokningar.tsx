import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  cancelBooking,
  createBooking,
  getMyBookings,
  getResourceDay,
  getResources,
} from "@/lib/app.functions";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import {
  dateLong,
  openHoursLabel,
  resourceKindLabels,
  slotLengthLabel,
  timeRange,
  toDateInput,
} from "@/lib/format";
import { Button } from "@/components/ui/button";
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
import { z } from "zod";

import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/app/bokningar")({
  validateSearch: z.object({ resurs: z.string().uuid().optional().catch(undefined) }),
  head: () => ({
    meta: [
      { title: "Bokningar – Boendeplattformen" },
      {
        name: "description",
        content: "Boka tvättstuga, bastu, gästrum, festlokal och laddplats i din fastighet.",
      },
      { property: "og:title", content: "Bokningar – Boendeplattformen" },
      { property: "og:description", content: "Boka gemensamma utrymmen direkt i kalendern." },
    ],
  }),
  component: BookingsPage,
});

function BookingsPage() {
  const resourcesFn = useServerFn(getResources);
  const dayFn = useServerFn(getResourceDay);
  const myFn = useServerFn(getMyBookings);
  const create = useServerFn(createBooking);
  const cancel = useServerFn(cancelBooking);
  const qc = useQueryClient();

  const { data: resources, isPending } = useQuery({
    queryKey: ["resources"],
    queryFn: () => resourcesFn(),
  });
  const { data: myBookings } = useQuery({ queryKey: ["my-bookings"], queryFn: () => myFn() });

  const { resurs } = Route.useSearch();
  const [resourceId, setResourceId] = useState<string | null>(resurs ?? null);
  const [date, setDate] = useState(() => toDateInput(new Date()));
  // Tvättstugan är det vanligaste att boka, så den väljs först om den finns.
  const activeResourceId =
    resourceId ?? resources?.find((r) => r.kind === "laundry")?.id ?? resources?.[0]?.id ?? null;
  // Ett tryck på en tid eller "Avboka" frågar först, så att inget händer av misstag.
  const [pendingSlot, setPendingSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [pendingCancel, setPendingCancel] = useState<{
    id: string;
    name: string;
    starts_at: string;
    ends_at: string;
  } | null>(null);

  const { data: day } = useQuery({
    queryKey: ["resource-day", activeResourceId, date],
    queryFn: () => dayFn({ data: { resourceId: activeResourceId!, date } }),
    enabled: !!activeResourceId,
  });

  const book = useMutation({
    mutationFn: (v: { startsAt: string; endsAt: string }) =>
      create({ data: { resourceId: activeResourceId!, ...v } }),
    onSuccess: () => {
      toast.success("Din bokning är klar", {
        description: "Du hittar den under Mina bokningar.",
      });
      setPendingSlot(null);
      void qc.invalidateQueries({ queryKey: ["resource-day"] });
      void qc.invalidateQueries({ queryKey: ["my-bookings"] });
      void qc.invalidateQueries({ queryKey: ["resident-dashboard"] });
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
  });

  const drop = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => {
      toast.success("Bokningen är avbokad");
      setPendingCancel(null);
      void qc.invalidateQueries({ queryKey: ["resource-day"] });
      void qc.invalidateQueries({ queryKey: ["my-bookings"] });
      void qc.invalidateQueries({ queryKey: ["resident-dashboard"] });
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
  });

  if (isPending || !resources) return <LoadingBlock rows={4} />;

  const upcoming = (myBookings ?? []).filter((b) => new Date(b.ends_at).getTime() > Date.now());

  const resource = day?.resource;
  const slots: { start: Date; end: Date }[] = [];
  if (resource) {
    const [openH, openM] = resource.open_from.split(":").map(Number);
    const [closeH, closeM] = resource.open_to.split(":").map(Number);
    const cursor = new Date(`${date}T00:00:00`);
    cursor.setHours(openH ?? 0, openM ?? 0, 0, 0);
    const closing = new Date(`${date}T00:00:00`);
    // 23:59 betyder öppet till midnatt, så att dygnspass (t.ex. gästrum) går att boka.
    if (resource.open_to.slice(0, 5) >= "23:59") closing.setDate(closing.getDate() + 1);
    else closing.setHours(closeH ?? 23, closeM ?? 0, 0, 0);
    while (cursor < closing) {
      const end = new Date(cursor.getTime() + resource.slot_minutes * 60000);
      if (end > closing) break;
      slots.push({ start: new Date(cursor), end });
      cursor.setTime(end.getTime());
    }
  }

  const daysAhead = resource?.days_ahead ?? 14;
  const lastBookable = Date.now() + daysAhead * 864e5;
  const days = Array.from({ length: daysAhead }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div>
      <PageHeader
        title="Bokningar"
        subtitle="Välj vad du vill boka, välj en dag och tryck på en ledig tid."
      />

      <h2 className="mb-3 text-base font-semibold">1. Vad vill du boka?</h2>
      <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {resources.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setResourceId(r.id)}
            aria-pressed={activeResourceId === r.id}
            className={cn(
              "card-surface min-h-16 p-3 text-left transition hover:border-primary sm:p-4",
              activeResourceId === r.id && "border-primary bg-primary-soft ring-2 ring-primary/40",
            )}
          >
            <p className="text-base font-semibold">
              {r.icon} {r.name}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {r.location ?? resourceKindLabels[r.kind] ?? ""}
            </p>
            <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
              {openHoursLabel(r.open_from, r.open_to)}
            </p>
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Panel
            title={resource ? `2. Välj en tid – ${resource.name}` : "2. Välj en tid"}
            description={
              resource
                ? `${openHoursLabel(resource.open_from, resource.open_to)} · ${slotLengthLabel(resource.slot_minutes)}`
                : undefined
            }
          >
            <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
              {days.map((d) => {
                const value = toDateInput(d);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDate(value)}
                    aria-pressed={date === value}
                    className={cn(
                      "min-h-14 min-w-16 shrink-0 rounded-xl border border-border px-3 py-2 text-center text-sm transition hover:border-primary",
                      date === value && "border-primary bg-primary-soft font-semibold",
                    )}
                  >
                    <span className="block font-medium capitalize">
                      {new Intl.DateTimeFormat("sv-SE", { weekday: "short" }).format(d)}
                    </span>
                    <span className="mt-0.5 block text-muted-foreground">
                      {new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short" }).format(
                        d,
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {!resource ? (
              <EmptyState title="Välj först vad du vill boka" />
            ) : slots.length === 0 ? (
              <EmptyState
                title="Det går inte att boka den här dagen"
                description="Välj en annan dag ovanför."
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {slots.map((s) => {
                  const taken = (day?.bookings ?? []).find(
                    (b) => new Date(b.starts_at).getTime() === s.start.getTime(),
                  );
                  const past = s.start.getTime() < Date.now();
                  const tooFar = s.start.getTime() > lastBookable;
                  return (
                    <button
                      key={s.start.toISOString()}
                      type="button"
                      disabled={!!taken || past || tooFar || book.isPending}
                      onClick={() => setPendingSlot(s)}
                      className={cn(
                        "min-h-16 rounded-xl border px-3 py-3 text-base font-medium transition",
                        taken || past || tooFar
                          ? "cursor-not-allowed border-border bg-muted text-muted-foreground"
                          : "border-success/40 bg-success-soft/40 hover:border-primary hover:bg-accent",
                      )}
                    >
                      {timeRange(s.start.toISOString(), s.end.toISOString())}
                      <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
                        {taken
                          ? "Upptagen"
                          : past
                            ? "Har passerat"
                            : tooFar
                              ? "Går inte att boka än"
                              : "Ledig – tryck för att boka"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        <Panel
          title="Mina bokningar"
          className={cn(upcoming.length > 0 && "order-first lg:order-none")}
        >
          {upcoming.length === 0 ? (
            <EmptyState
              title="Du har inga kommande bokningar"
              description="Välj vad du vill boka och tryck på en ledig tid."
            />
          ) : (
            <ul className="space-y-3">
              {upcoming.map((b) => (
                <li key={b.id} className="rounded-xl border border-border p-4">
                  <p className="text-base font-medium">
                    {b.resources?.icon} {b.resources?.name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {dateLong(b.starts_at)}, kl. {timeRange(b.starts_at, b.ends_at)}
                  </p>
                  {canCancel(b) ? (
                    <Button
                      variant="outline"
                      className="mt-3"
                      disabled={drop.isPending}
                      onClick={() =>
                        setPendingCancel({
                          id: b.id,
                          name: b.resources?.name ?? "Bokningen",
                          starts_at: b.starts_at,
                          ends_at: b.ends_at,
                        })
                      }
                    >
                      Avboka
                    </Button>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Kan inte avbokas längre – det måste göras senast {b.resources?.cancel_hours}{" "}
                      timmar innan.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <AlertDialog open={!!pendingSlot} onOpenChange={(v) => !v && setPendingSlot(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vill du boka den här tiden?</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-foreground">
              {resource?.name}
              <br />
              {pendingSlot
                ? `${dateLong(pendingSlot.start.toISOString())}, kl. ${timeRange(pendingSlot.start.toISOString(), pendingSlot.end.toISOString())}`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              disabled={book.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pendingSlot)
                  book.mutate({
                    startsAt: pendingSlot.start.toISOString(),
                    endsAt: pendingSlot.end.toISOString(),
                  });
              }}
            >
              {book.isPending ? "Bokar…" : "Ja, boka tiden"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingCancel} onOpenChange={(v) => !v && setPendingCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vill du avboka?</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-foreground">
              {pendingCancel?.name}
              <br />
              {pendingCancel
                ? `${dateLong(pendingCancel.starts_at)}, kl. ${timeRange(pendingCancel.starts_at, pendingCancel.ends_at)}`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Nej, behåll bokningen</AlertDialogCancel>
            <AlertDialogAction
              disabled={drop.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pendingCancel) drop.mutate(pendingCancel.id);
              }}
            >
              {drop.isPending ? "Avbokar…" : "Ja, avboka"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function canCancel(b: { starts_at: string; resources: { cancel_hours: number } | null }) {
  const hours = b.resources?.cancel_hours ?? 0;
  return new Date(b.starts_at).getTime() - Date.now() >= hours * 3600_000;
}
