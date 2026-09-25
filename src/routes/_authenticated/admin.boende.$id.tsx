import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { OpenFileButton } from "@/components/open-file-button";
import { ArrowLeft } from "lucide-react";

import { getResidentDetail } from "@/lib/app.functions";
import { ResidentActions } from "@/components/resident-actions";
import { StatusPill } from "@/components/status-badge";
import { PageHeader, Panel, DataRow, LoadingBlock, EmptyState } from "@/components/ui-kit";
import { PaymentStatusBadge, RequestStatusBadge } from "@/components/status-badge";
import { dateLong, dateShort, kr, monthName, timeRange } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/boende/$id")({
  component: ResidentDetail,
});

function ResidentDetail() {
  const { id } = useParams({ from: "/_authenticated/admin/boende/$id" });
  const fn = useServerFn(getResidentDetail);
  const { data, isPending } = useQuery({
    queryKey: ["resident-detail", id],
    queryFn: () => fn({ data: { id } }),
  });

  if (isPending) return <LoadingBlock rows={5} />;
  if (!data) return <EmptyState title="Boende hittades inte" />;

  const unit = data.residency.units;

  return (
    <div>
      <Link
        to="/admin/boende"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Boenderegistret
      </Link>

      <PageHeader
        title={data.residency.resident_name}
        subtitle={`${unit?.address ?? ""} · Lägenhet ${unit?.unit_number ?? ""} · ${
          data.residency.tenure === "rented" ? "Hyresgäst" : "Medlem"
        }`}
        action={<ResidentActions residency={data.residency} />}
      />
      {data.residency.status !== "active" ? (
        <div className="-mt-4 mb-6">
          <StatusPill tone="neutral">
            Utflyttad {data.residency.move_out_date ? dateLong(data.residency.move_out_date) : ""}
          </StatusPill>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Kontaktuppgifter">
          <dl>
            <DataRow label="E-post" value={data.residency.email ?? "—"} />
            <DataRow label="Telefon" value={data.residency.phone ?? "—"} />
            <DataRow label="Inflyttning" value={dateLong(data.residency.move_in_date)} />
            <DataRow label="Konto" value={data.residency.user_id ? "Aktiverat" : "Ej aktiverat"} />
          </dl>
        </Panel>

        <Panel title="Lägenheten">
          <dl>
            <DataRow label="Objektsnummer" value={unit?.object_number ?? "—"} />
            <DataRow label="Yta" value={`${Number(unit?.size_sqm)} m²`} />
            <DataRow label="Rum" value={Number(unit?.rooms)} />
            <DataRow label="Våning" value={unit?.floor ?? "—"} />
            <DataRow label="Månadsbelopp" value={kr(unit?.monthly_amount)} />
            <DataRow label="Förråd" value={unit?.storage ?? "—"} />
            <DataRow label="Parkering" value={unit?.parking ?? "—"} />
            <DataRow label="Nycklar" value={unit?.key_count ?? "—"} />
          </dl>
        </Panel>

        <Panel title="Ärendehistorik">
          {data.requests.length === 0 ? (
            <EmptyState title="Inga ärenden" />
          ) : (
            <ul className="space-y-3">
              {data.requests.map((r) => (
                <li key={r.id}>
                  <Link
                    to="/admin/arenden/$id"
                    params={{ id: r.id }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-surface-muted"
                  >
                    <div>
                      <p className="text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        #{r.ticket_number} · {dateShort(r.created_at)}
                      </p>
                    </div>
                    <RequestStatusBadge status={r.status as string} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Betalningshistorik">
          {data.payments.length === 0 ? (
            <EmptyState title="Inga betalningar" />
          ) : (
            <ul className="divide-y divide-border">
              {data.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm">{monthName(p.period)}</span>
                  <span className="text-sm font-medium tnum">{kr(p.amount)}</span>
                  <PaymentStatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Bokningar">
          {data.bookings.length === 0 ? (
            <EmptyState title="Inga bokningar" />
          ) : (
            <ul className="divide-y divide-border">
              {data.bookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    {b.resources?.icon} {b.resources?.name}
                  </span>
                  <span className="text-muted-foreground">
                    {dateShort(b.starts_at)} · {timeRange(b.starts_at, b.ends_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Dokument kopplade till lägenheten">
          {data.documents.length === 0 ? (
            <EmptyState title="Inga dokument" />
          ) : (
            <ul className="divide-y divide-border">
              {data.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>{d.title}</span>
                  <OpenFileButton path={d.storage_path} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
