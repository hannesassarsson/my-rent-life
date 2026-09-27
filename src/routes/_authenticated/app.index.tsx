import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, ChevronRight, MessageSquare, Wrench } from "lucide-react";

import { getResidentDashboard } from "@/lib/app.functions";
import { Panel, EmptyState, LoadingBlock } from "@/components/ui-kit";
import { PaymentStatusBadge, RequestStatusBadge, StatusPill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { dateLong, dateTime, greeting, kr, monthName, timeRange } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/")({
  component: ResidentOverview,
});

/** De vanligaste sakerna en boende vill göra, som stora knappar med text. */
const quickActions = [
  { to: "/app/felanmalan", hash: "ny", icon: Wrench, label: "Gör en felanmälan" },
  { to: "/app/bokningar", icon: CalendarDays, label: "Boka tvättstuga eller lokal" },
  { to: "/app/meddelanden", icon: MessageSquare, label: "Skriv till föreningen" },
] as const;

function PanelLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary hover:underline"
    >
      {children}
      <ChevronRight className="size-4" />
    </Link>
  );
}

function ResidentOverview() {
  const fn = useServerFn(getResidentDashboard);
  const { data, isPending } = useQuery({ queryKey: ["resident-dashboard"], queryFn: () => fn() });

  if (isPending || !data) return <LoadingBlock rows={4} />;

  const unit = data.me.residency?.units;
  const isRent = unit?.tenure === "rented";
  const hasEconomy = data.me.features.includes("economy");
  const openRequests = data.requests.filter((r) => r.status !== "closed");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
          {greeting(data.me.profile?.full_name)}
        </h1>
        {unit ? (
          <p className="mt-1.5 text-base text-muted-foreground">
            {unit.address}, lägenhet {unit.unit_number}
          </p>
        ) : (
          <p className="mt-1.5 text-base text-muted-foreground">
            Ingen lägenhet är kopplad till ditt konto ännu. Kontakta föreningen om det är fel.
          </p>
        )}
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {quickActions.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            {...("hash" in a ? { hash: a.hash } : {})}
            className="card-surface flex min-h-16 items-center gap-3 px-4 py-3 text-base font-medium transition hover:border-primary"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              <a.icon className="size-5" />
            </span>
            <span className="flex-1">{a.label}</span>
            <ChevronRight className="size-5 text-muted-foreground" />
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {hasEconomy ? (
          <Panel
            title={isRent ? "Min hyra" : "Min avgift"}
            action={<PanelLink to="/app/ekonomi">Visa alla</PanelLink>}
          >
            {data.payment ? (
              <>
                <p className="text-sm text-muted-foreground">{monthName(data.payment.period)}</p>
                <p className="mt-1 text-3xl font-semibold tnum">{kr(data.payment.amount)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ska vara betald senast {dateLong(data.payment.due_date)}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <PaymentStatusBadge status={data.payment.status} />
                  {data.payment.status !== "paid" ? (
                    <Button asChild>
                      <Link to="/app/ekonomi">Visa hur du betalar</Link>
                    </Button>
                  ) : null}
                </div>
              </>
            ) : (
              <EmptyState
                title={isRent ? "Ingen hyra att betala just nu" : "Ingen avgift att betala just nu"}
              />
            )}
          </Panel>
        ) : null}

        <Panel
          title="Viktig information"
          action={<PanelLink to="/app/information">Alla nyheter</PanelLink>}
        >
          {data.announcements.length === 0 ? (
            <EmptyState
              title="Inga nyheter just nu"
              description="När föreningen publicerar något får du en notis."
            />
          ) : (
            <ul className="space-y-3">
              {data.announcements.map((a) => (
                <li key={a.id}>
                  <Link
                    to="/app/information"
                    className="block rounded-xl border border-border p-4 transition hover:border-primary"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-base font-medium">{a.title}</p>
                      {a.is_pinned ? <StatusPill tone="info">Viktigt</StatusPill> : null}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{a.body}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Mina felanmälningar"
          action={<PanelLink to="/app/felanmalan">Visa alla</PanelLink>}
        >
          {openRequests.length === 0 ? (
            <EmptyState
              title="Du har inga pågående felanmälningar"
              description="Är något trasigt i lägenheten eller i huset?"
              action={
                <Button variant="outline" asChild>
                  <Link to="/app/felanmalan" hash="ny">
                    Gör en felanmälan
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {openRequests.map((r) => (
                <li key={r.id}>
                  <Link
                    to="/app/felanmalan/$id"
                    params={{ id: r.id }}
                    className="block rounded-xl border border-border p-4 transition hover:border-primary"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-medium">{r.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Ärende {r.ticket_number} · uppdaterat {dateTime(r.updated_at)}
                        </p>
                      </div>
                      <RequestStatusBadge status={r.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Mina kommande bokningar"
          action={<PanelLink to="/app/bokningar">Boka</PanelLink>}
        >
          {data.bookings.length === 0 ? (
            <EmptyState
              title="Du har inga kommande bokningar"
              description="Vill du boka tvättstugan eller en gemensam lokal?"
              action={
                <Button variant="outline" asChild>
                  <Link to="/app/bokningar">Se lediga tider</Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {data.bookings.map((b) => (
                <li key={b.id}>
                  <Link
                    to="/app/bokningar"
                    className="block rounded-xl border border-border p-4 transition hover:border-primary"
                  >
                    <p className="text-base font-medium">{b.resources?.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {dateLong(b.starts_at)}, kl. {timeRange(b.starts_at, b.ends_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {data.meetings.length > 0 ? (
          <Panel
            title="Kommande möten"
            className="lg:col-span-2"
            action={<PanelLink to="/app/moten">Visa möten</PanelLink>}
          >
            <ul className="divide-y divide-border">
              {data.meetings.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3 first:pt-0 last:pb-0"
                >
                  <span className="text-base font-medium">{m.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {dateLong(m.starts_at)}, kl.{" "}
                    {new Intl.DateTimeFormat("sv-SE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(m.starts_at))}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>

      {data.me.isStaff ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Du ingår i föreningens styrelse eller förvaltning.{" "}
          <Link to="/admin" className="font-medium text-primary underline underline-offset-4">
            Gå till administrationen
          </Link>
        </p>
      ) : null}
    </div>
  );
}
