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
import { dateLong, resourceKindLabels, timeRange, toDateInput } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/bokningar")({
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

  const [resourceId, setResourceId] = useState<string | null>(null);
  const [date, setDate] = useState(() => toDateInput(new Date()));
  const activeResourceId = resourceId ?? resources?.[0]?.id ?? null;

  const { data: day } = useQuery({
    queryKey: ["resource-day", activeResourceId, date],
    queryFn: () => dayFn({ data: { resourceId: activeResourceId!, date } }),
    enabled: !!activeResourceId,
  });

  const book = useMutation({
    mutationFn: (v: { startsAt: string; endsAt: string }) =>
      create({ data: { resourceId: activeResourceId!, ...v } }),
    onSuccess: () => {
      toast.success("Tiden är bokad");
      void qc.invalidateQueries({ queryKey: ["resource-day"] });
      void qc.invalidateQueries({ queryKey: ["my-bookings"] });
      void qc.invalidateQueries({ queryKey: ["resident-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const drop = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => {
      toast.success("Bokningen är avbokad");
      void qc.invalidateQueries({ queryKey: ["resource-day"] });
      void qc.invalidateQueries({ queryKey: ["my-bookings"] });
      void qc.invalidateQueries({ queryKey: ["resident-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || !resources) return <LoadingBlock rows={4} />;

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
      <PageHeader title="Bokningar" subtitle="Boka gemensamma utrymmen i din fastighet" />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {resources.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setResourceId(r.id)}
            className={cn(
              "card-surface p-4 text-left transition hover:border-primary",
              activeResourceId === r.id && "border-primary ring-1 ring-primary/30",
            )}
          >
            <p className="text-sm font-semibold">
              {r.icon} {r.name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {resourceKindLabels[r.kind] ?? r.kind}
              {r.location ? ` · ${r.location}` : ""}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {r.open_from.slice(0, 5)}–{r.open_to.slice(0, 5)} · {r.slot_minutes} min
            </p>
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel
            title={resource ? `Lediga tider – ${resource.name}` : "Lediga tider"}
            description={dateLong(`${date}T12:00:00`)}
          >
            <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
              {days.map((d) => {
                const value = toDateInput(d);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDate(value)}
                    className={cn(
                      "shrink-0 rounded-xl border border-border px-3 py-2 text-center text-xs transition hover:border-primary",
                      date === value && "border-primary bg-accent",
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
              <EmptyState title="Välj en resurs" />
            ) : slots.length === 0 ? (
              <EmptyState title="Inga tider den här dagen" />
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
                      onClick={() =>
                        book.mutate({
                          startsAt: s.start.toISOString(),
                          endsAt: s.end.toISOString(),
                        })
                      }
                      className={cn(
                        "rounded-xl border px-3 py-3 text-sm font-medium transition",
                        taken || past || tooFar
                          ? "cursor-not-allowed border-border bg-muted text-muted-foreground"
                          : "border-border hover:border-primary hover:bg-accent",
                      )}
                    >
                      {timeRange(s.start.toISOString(), s.end.toISOString())}
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {taken ? "Bokad" : past ? "Passerad" : tooFar ? "Ej bokningsbar" : "Ledig"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Mina bokningar">
          {!myBookings || myBookings.length === 0 ? (
            <EmptyState title="Inga bokningar" />
          ) : (
            <ul className="space-y-3">
              {myBookings.map((b) => (
                <li key={b.id} className="rounded-xl border border-border p-4">
                  <p className="text-sm font-medium">
                    {b.resources?.icon} {b.resources?.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dateLong(b.starts_at)} · {timeRange(b.starts_at, b.ends_at)}
                  </p>
                  {new Date(b.ends_at).getTime() > Date.now() ? (
                    canCancel(b) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        disabled={drop.isPending}
                        onClick={() => drop.mutate(b.id)}
                      >
                        Avboka
                      </Button>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Kan avbokas senast {b.resources?.cancel_hours} timmar innan
                      </p>
                    )
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function canCancel(b: { starts_at: string; resources: { cancel_hours: number } | null }) {
  const hours = b.resources?.cancel_hours ?? 0;
  return new Date(b.starts_at).getTime() - Date.now() >= hours * 3600_000;
}
