import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Search } from "lucide-react";
import { z } from "zod";

import { OpenFileButton } from "@/components/open-file-button";
import { getDocuments } from "@/lib/app.functions";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { dateLong, docTypeLabel } from "@/lib/format";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/app/dokument")({
  validateSearch: z.object({ q: z.string().max(100).optional().catch(undefined) }),
  head: () => ({
    meta: [
      { title: "Föreningspärmen – Boendeplattformen" },
      {
        name: "description",
        content: "Stadgar, ordningsregler, årsredovisning, protokoll och avtal för ditt boende.",
      },
      { property: "og:title", content: "Föreningspärmen – Boendeplattformen" },
      { property: "og:description", content: "Stadgar, protokoll och avtal samlade digitalt." },
    ],
  }),
  component: DocumentsPage,
});

/** Viktigast först, som flikarna i en föreningspärm. */
const ORDER = [
  "bylaws",
  "statutes",
  "rules",
  "info",
  "annual_report",
  "economy",
  "protocol",
  "minutes",
  "insurance",
  "maintenance",
  "contract",
  "other",
];

const rank = (type: string) => {
  const i = ORDER.indexOf(type);
  return i === -1 ? ORDER.length : i;
};

function DocumentsPage() {
  const fn = useServerFn(getDocuments);
  const { q: initial } = Route.useSearch();
  const { data, isPending } = useQuery({ queryKey: ["documents"], queryFn: () => fn() });
  const [q, setQ] = useState(initial ?? "");

  const needle = q.trim().toLowerCase();
  const list = (data ?? []).filter((d) =>
    `${d.title} ${docTypeLabel(d.doc_type)}`.toLowerCase().includes(needle),
  );
  const groups = Object.entries(
    list.reduce<Record<string, typeof list>>((acc, d) => {
      // Stadgar finns under två typnamn; visa dem som en flik.
      const key = docTypeLabel(d.doc_type);
      (acc[key] ??= []).push(d);
      return acc;
    }, {}),
  ).sort(([, a], [, b]) => rank(a[0]!.doc_type) - rank(b[0]!.doc_type));

  return (
    <div>
      <PageHeader
        title="Föreningspärmen"
        subtitle="Stadgar, regler, årsredovisningar, protokoll och dokument för din bostad."
      />

      <div className="mb-6 max-w-xl">
        <label htmlFor="doc-search" className="mb-2 block text-base font-medium">
          Sök i pärmen
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="doc-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="T.ex. stadgar, trivselregler eller årsredovisning"
            className="h-12 pl-11 text-base"
          />
        </div>
      </div>

      {isPending ? (
        <LoadingBlock rows={4} />
      ) : list.length === 0 ? (
        <EmptyState
          title={
            needle
              ? `Inget dokument matchar ”${q.trim()}”`
              : "Föreningen har inte lagt upp några dokument ännu"
          }
          description={
            needle
              ? "Pröva ett annat ord. Hittar du inte det du söker kan du fråga föreningen."
              : "När styrelsen lägger upp stadgar, protokoll och andra dokument hittar du dem här."
          }
          action={
            <Link to="/app/meddelanden" className="text-base font-medium text-primary">
              Fråga föreningen
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {groups.map(([label, docs]) => (
            <Panel key={label} title={label} description={`${docs.length} dokument`}>
              <ul className="space-y-3">
                {docs.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <FileText className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-base font-medium break-words">{d.title}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {dateLong(d.created_at)}
                          {d.units ? ` · Lägenhet ${d.units.unit_number}` : ""}
                          {d.properties?.name ? ` · ${d.properties.name}` : ""}
                        </p>
                      </div>
                    </div>
                    <OpenFileButton path={d.storage_path} />
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
