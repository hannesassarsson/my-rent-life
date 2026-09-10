import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getAdminOverview } from "@/lib/app.functions";
import { Kpi, Panel, LoadingBlock, EmptyState, PageHeader } from "@/components/ui-kit";
import { ProjectStatusBadge, StatusPill } from "@/components/status-badge";
import { dateLong, kr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const fn = useServerFn(getAdminOverview);
  const { data, isPending, error } = useQuery({ queryKey: ["admin-overview"], queryFn: () => fn() });

  if (error) {
    return (
      <EmptyState
        title="Du saknar behörighet till administrationen"
        description="Logga in med ett administratörskonto för att se den här vyn."
      />
    );
  }
  if (isPending || !data) return <LoadingBlock rows={4} />;

  const topCategories = Object.entries(data.requests.categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div>
      <PageHeader title="Översikt" subtitle={data.me.organization?.name ?? undefined} />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Lägenheter"
          value={data.units.total}
          hint={`${data.units.active} aktiva`}
        />
        <Kpi
          label="Felanmälningar"
          value={data.requests.open}
          tone={data.requests.urgent > 0 ? "warning" : "default"}
          hint={`${data.requests.newToday} nya idag · ${data.requests.urgent} akuta`}
        />
        <Kpi
          label="Betalningsgrad"
          value={`${data.economy.paidShare.toString().replace(".", ",")} %`}
          tone="success"
          hint={`${data.economy.unpaid} obetalda · ${kr(data.economy.billed)} fakturerat`}
        />
        <Kpi
          label="Kommunikation"
          value={data.drafts.length}
          hint="opublicerade meddelanden"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Vad behöver jag veta idag?" description="AI-assistent">
          <ul className="space-y-3 text-sm">
            {data.requests.stale > 0 ? (
              <li className="flex items-start gap-3">
                <StatusPill tone="danger">Ärenden</StatusPill>
                <span>{data.requests.stale} felanmälningar har väntat längre än 7 dagar.</span>
              </li>
            ) : null}
            {data.economy.unpaid > 0 ? (
              <li className="flex items-start gap-3">
                <StatusPill tone="warning">Ekonomi</StatusPill>
                <span>{data.economy.unpaid} avgifter eller hyror är obetalda denna period.</span>
              </li>
            ) : null}
            {data.drafts.length > 0 ? (
              <li className="flex items-start gap-3">
                <StatusPill tone="warning">Information</StatusPill>
                <span>{data.drafts.length} utkast är inte publicerade.</span>
              </li>
            ) : null}
            {data.nextMeeting ? (
              <li className="flex items-start gap-3">
                <StatusPill tone="info">Möte</StatusPill>
                <span>
                  {data.nextMeeting.title} – {dateLong(data.nextMeeting.starts_at)}.
                </span>
              </li>
            ) : null}
            <li className="flex items-start gap-3">
              <StatusPill tone="info">Ärenden</StatusPill>
              <span>
                Genomsnittlig lösningstid är {String(data.requests.avgResolutionDays).replace(".", ",")}{" "}
                dagar.
              </span>
            </li>
          </ul>
        </Panel>

        <Panel title="Vanligaste kategorier">
          {topCategories.length === 0 ? (
            <EmptyState title="Inga ärenden ännu" />
          ) : (
            <ul className="space-y-3">
              {topCategories.map(([name, count]) => {
                const share = Math.round((count / Math.max(1, data.requests.total)) * 100);
                return (
                  <li key={name}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{name}</span>
                      <span className="text-muted-foreground tnum">{share} %</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Beläggning bokningsresurser">
          <ul className="space-y-3">
            {data.bookings.occupancy.map((o) => (
              <li key={o.id}>
                <div className="flex items-center justify-between text-sm">
                  <span>{o.name}</span>
                  <span className="text-muted-foreground tnum">{o.rate} %</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-info" style={{ width: `${o.rate}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Underhållsplan">
          <ul className="space-y-3">
            {data.projects
              .slice()
              .sort((a, b) => a.year - b.year)
              .map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-4"
                >
                  <div>
                    <p className="text-sm font-medium">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.year}</p>
                  </div>
                  <ProjectStatusBadge status={p.status} />
                </li>
              ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
