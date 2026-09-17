import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMyHome } from "@/lib/app.functions";
import { DataRow, EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { dateLong, kr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/boende")({
  head: () => ({
    meta: [
      { title: "Mitt boende – Boendeplattformen" },
      {
        name: "description",
        content: "Alla uppgifter om din bostad: storlek, rum, förråd, parkering och dokument.",
      },
      { property: "og:title", content: "Mitt boende – Boendeplattformen" },
      {
        property: "og:description",
        content: "Alla uppgifter om din bostad samlade på ett ställe.",
      },
    ],
  }),
  component: MyHome,
});

function MyHome() {
  const fn = useServerFn(getMyHome);
  const { data, isPending } = useQuery({ queryKey: ["my-home"], queryFn: () => fn() });

  if (isPending || !data) return <LoadingBlock rows={4} />;

  const residency = data.me.residency;
  const unit = residency?.units;
  const building = unit?.buildings;
  const property = building?.properties;
  const unitDocs = data.documents.filter((d) => d.unit_id && d.unit_id === unit?.id);

  if (!unit) {
    return (
      <div>
        <PageHeader title="Mitt boende" />
        <EmptyState
          title="Ingen bostad kopplad"
          description="Kontakta förvaltningen för att koppla ditt konto till din bostad."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Mitt boende"
        subtitle={`${unit.address} · Lägenhet ${unit.unit_number}`}
        action={
          <StatusPill tone={unit.tenure === "rented" ? "info" : "success"}>
            {unit.tenure === "rented" ? "Hyresrätt" : "Bostadsrätt"}
          </StatusPill>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Bostaden">
          <dl>
            <DataRow label="Lägenhetsnummer" value={unit.unit_number} />
            <DataRow label="Objektsnummer" value={unit.object_number ?? "–"} />
            <DataRow label="Adress" value={unit.address} />
            <DataRow label="Storlek" value={`${Number(unit.size_sqm)} m²`} />
            <DataRow label="Antal rum" value={Number(unit.rooms)} />
            <DataRow label="Våning" value={unit.floor ?? "–"} />
            <DataRow label="Balkong" value={unit.balcony ? "Ja" : "Nej"} />
          </dl>
        </Panel>

        <Panel title="Avtal och tillhörigheter">
          <dl>
            <DataRow
              label={unit.tenure === "rented" ? "Månadshyra" : "Månadsavgift"}
              value={kr(unit.monthly_amount)}
            />
            <DataRow label="Inflyttning" value={dateLong(residency?.move_in_date)} />
            <DataRow label="Förråd" value={unit.storage ?? "–"} />
            <DataRow label="Parkering" value={unit.parking ?? "–"} />
            <DataRow label="Antal nycklar" value={unit.key_count} />
          </dl>
        </Panel>

        <Panel title="Fastighet">
          <dl>
            <DataRow label="Förening / värd" value={data.me.organization?.name ?? "–"} />
            <DataRow label="Fastighet" value={property?.name ?? "–"} />
            <DataRow label="Hus" value={building?.name ?? "–"} />
            <DataRow
              label="Ort"
              value={property ? `${property.postal_code ?? ""} ${property.city ?? ""}`.trim() : "–"}
            />
          </dl>
        </Panel>

        <Panel title="Mina dokument" description="Dokument som gäller din bostad">
          {unitDocs.length === 0 ? (
            <EmptyState title="Inga dokument för din bostad" />
          ) : (
            <ul className="space-y-3">
              {unitDocs.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-4"
                >
                  <div>
                    <p className="text-sm font-medium">{d.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {d.doc_type} · {d.file_kind?.toUpperCase()} · {d.file_size ?? ""}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{dateLong(d.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
