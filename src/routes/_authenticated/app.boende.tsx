import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useOrgProfile } from "@/lib/use-org-profile";
import { OpenFileButton } from "@/components/open-file-button";
import { ContactPanel as AssociationContact } from "@/components/contact-panel";
import { KeyRound, UserRound } from "lucide-react";

import { getMyHome } from "@/lib/app.functions";
import { Button } from "@/components/ui/button";
import { DataRow, EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { InspectionStatusPill, StatusPill } from "@/components/status-badge";
import { dateLong, docTypeLabel, inspectionKindLabels, kr } from "@/lib/format";

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
  const { profile } = useOrgProfile();
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
        <PageHeader title={profile.homeLabel} />
        <EmptyState
          title="Ditt konto är inte kopplat till en lägenhet"
          description="Be styrelsen eller förvaltaren om en inbjudningslänk till din lägenhet. När du öppnar den kopplas kontot automatiskt."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={profile.homeLabel}
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

        <Panel title="Hushållet" description="De som är registrerade i lägenheten">
          {data.household.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen registrerad.</p>
          ) : (
            <ul className="space-y-2">
              {data.household.map((h, i) => (
                <li key={`${h.resident_name}-${i}`} className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                    <UserRound className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-medium">
                      {h.resident_name}
                      {h.is_me ? (
                        <span className="font-normal text-muted-foreground"> (du)</span>
                      ) : null}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {h.is_primary ? "Primär boende" : "Hushållsmedlem"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            Ska någon flytta in eller ut? Skriv till föreningen så uppdaterar de uppgifterna.
          </p>
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
          {data.me.features.includes("keys") ? (
            <Button variant="outline" asChild className="mt-4">
              <Link to="/app/nycklar">
                <KeyRound className="size-4" /> Mina digitala nycklar
              </Link>
            </Button>
          ) : null}
        </Panel>

        <ContactPanel
          fullName={data.me.profile?.full_name ?? ""}
          email={data.me.profile?.email ?? ""}
          phone={data.me.profile?.phone ?? ""}
        />

        <AssociationContact org={data.me.organization} />

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
                      {docTypeLabel(d.doc_type)} · {d.file_kind?.toUpperCase()} ·{" "}
                      {d.file_size ?? ""}
                    </p>
                  </div>
                  <OpenFileButton path={d.storage_path} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <InspectionsPanel inspections={data.inspections} />
      </div>
    </div>
  );
}

type Inspection = Awaited<ReturnType<typeof getMyHome>>["inspections"][number];

const dateTime = new Intl.DateTimeFormat("sv-SE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

function InspectionsPanel({ inspections }: { inspections: Inspection[] }) {
  const upcoming = inspections
    .filter((i) => i.status === "planned")
    .sort((a, b) => ((a.scheduled_at ?? "") < (b.scheduled_at ?? "") ? -1 : 1));
  const done = inspections.filter((i) => i.status === "completed");

  return (
    <Panel
      title="Besiktningar"
      description="Planerade besiktningar och protokoll för din bostad och fastighet"
      className="lg:col-span-2"
    >
      {inspections.length === 0 ? (
        <EmptyState title="Inga besiktningar" />
      ) : (
        <ul className="space-y-3">
          {[...upcoming, ...done].map((i) => (
            <li key={i.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {inspectionKindLabels[i.kind as keyof typeof inspectionKindLabels] ?? i.kind}
                    {i.unit_id ? "" : " · hela fastigheten"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {i.status === "completed"
                      ? `Genomförd ${dateLong(i.completed_at ?? i.scheduled_at)}`
                      : i.scheduled_at
                        ? dateTime.format(new Date(i.scheduled_at))
                        : "Tid meddelas senare"}
                    {i.inspector_name ? ` · ${i.inspector_name}` : ""}
                  </p>
                </div>
                <InspectionStatusPill status={i.status} result={i.result} />
              </div>
              {i.status === "planned" && i.note ? (
                <p className="mt-3 text-sm text-muted-foreground">{i.note}</p>
              ) : null}
              {i.status === "completed" && i.protocol ? (
                <p className="mt-3 whitespace-pre-line rounded-lg bg-muted/50 p-3 text-sm">
                  {i.protocol}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Visar kontaktuppgifterna; de ändras på ett enda ställe, Min profil. */
function ContactPanel({
  fullName,
  email,
  phone,
}: {
  fullName: string;
  email: string;
  phone: string;
}) {
  return (
    <Panel
      title="Mina kontaktuppgifter"
      description="Används av föreningen och hantverkare vid ärenden"
      action={
        <Button variant="outline" asChild>
          <Link to="/app/profil">Ändra kontaktuppgifter</Link>
        </Button>
      }
    >
      <dl>
        <DataRow label="Namn" value={fullName || "–"} />
        <DataRow label="E-post" value={email || "–"} />
        <DataRow label="Telefon" value={phone || "–"} />
      </dl>
    </Panel>
  );
}
