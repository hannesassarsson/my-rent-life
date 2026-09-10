import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getResidentDashboard } from "@/lib/app.functions";
import { Panel, EmptyState, LoadingBlock, DataRow } from "@/components/ui-kit";
import { PaymentStatusBadge, RequestStatusBadge, StatusPill } from "@/components/status-badge";
import { dateLong, dateTime, greeting, kr, monthName, timeRange } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/")({
  component: ResidentOverview,
});

function ResidentOverview() {
  const fn = useServerFn(getResidentDashboard);
  const { data, isPending } = useQuery({ queryKey: ["resident-dashboard"], queryFn: () => fn() });

  if (isPending || !data) return <LoadingBlock rows={4} />;

  const unit = data.me.residency?.units;
  const isRent = unit?.tenure === "rented";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
          {greeting(data.me.profile?.full_name)}
        </h1>
        {unit ? (
          <p className="mt-1.5 text-sm text-muted-foreground">
            {unit.address} · Lägenhet {unit.unit_number} — {Number(unit.size_sqm)} m² ·{" "}
            {Number(unit.rooms)} rum
          </p>
        ) : (
          <p className="mt-1.5 text-sm text-muted-foreground">
            Ingen lägenhet är kopplad till ditt konto ännu.
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={isRent ? "Min hyra" : "Min avgift"}>
          {data.payment ? (
            <>
              <p className="text-sm text-muted-foreground">{monthName(data.payment.period)}</p>
              <p className="mt-1 text-3xl font-semibold tnum">{kr(data.payment.amount)}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Förfaller {dateLong(data.payment.due_date)}
              </p>
              <div className="mt-4">
                <PaymentStatusBadge status={data.payment.status} />
              </div>
            </>
          ) : (
            <EmptyState title="Inga avgifter registrerade" />
          )}
        </Panel>

        <Panel title="Mina felanmälningar">
          {data.requests.length === 0 ? (
            <EmptyState title="Inga felanmälningar" description="Allt lugnt i din lägenhet." />
          ) : (
            <ul className="space-y-3">
              {data.requests.map((r) => (
                <li key={r.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{r.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ärende #{r.ticket_number} · senast uppdaterad {dateTime(r.updated_at)}
                      </p>
                    </div>
                    <RequestStatusBadge status={r.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Nästa bokning">
          {data.bookings.length === 0 ? (
            <EmptyState title="Inga kommande bokningar" />
          ) : (
            <ul className="space-y-3">
              {data.bookings.map((b) => (
                <li key={b.id} className="rounded-xl border border-border p-4">
                  <p className="text-sm font-medium">
                    {b.resources?.icon} {b.resources?.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {timeRange(b.starts_at, b.ends_at)} · {dateLong(b.starts_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Viktig information">
          {data.announcements.length === 0 ? (
            <EmptyState title="Ingen information just nu" />
          ) : (
            <ul className="space-y-3">
              {data.announcements.map((a) => (
                <li key={a.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">📢 {a.title}</p>
                    {a.is_pinned ? <StatusPill tone="info">Viktigt</StatusPill> : null}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Kommande" className="lg:col-span-2">
          {data.meetings.length === 0 ? (
            <EmptyState title="Inga inbokade möten" />
          ) : (
            <dl>
              {data.meetings.map((m) => (
                <DataRow
                  key={m.id}
                  label={`📅 ${m.title}`}
                  value={`${dateLong(m.starts_at)} · ${new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit" }).format(new Date(m.starts_at))}`}
                />
              ))}
            </dl>
          )}
        </Panel>
      </div>

      {data.me.isStaff ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Du har administratörsbehörighet.{" "}
          <Link to="/admin" className="text-primary underline-offset-4 hover:underline">
            Gå till administrationen
          </Link>
        </p>
      ) : null}
    </div>
  );
}
