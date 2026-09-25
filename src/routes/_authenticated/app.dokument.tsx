import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getDocuments } from "@/lib/app.functions";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { dateLong, docTypeLabel } from "@/lib/format";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/app/dokument")({
  head: () => ({
    meta: [
      { title: "Dokument – Boendeplattformen" },
      {
        name: "description",
        content: "Stadgar, protokoll, avtal och andra dokument för ditt boende.",
      },
      { property: "og:title", content: "Dokument – Boendeplattformen" },
      { property: "og:description", content: "Stadgar, protokoll och avtal samlade digitalt." },
    ],
  }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const fn = useServerFn(getDocuments);
  const { data, isPending } = useQuery({ queryKey: ["documents"], queryFn: () => fn() });
  const [q, setQ] = useState("");

  const list = (data ?? []).filter((d) =>
    `${d.title} ${d.doc_type}`.toLowerCase().includes(q.toLowerCase()),
  );
  const groups = list.reduce<Record<string, typeof list>>((acc, d) => {
    (acc[d.doc_type] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Dokument"
        subtitle="Allt från stadgar och protokoll till avtal för din bostad"
        action={
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sök dokument…"
            className="w-full sm:w-64"
          />
        }
      />

      {isPending ? (
        <LoadingBlock rows={4} />
      ) : list.length === 0 ? (
        <EmptyState title="Inga dokument hittades" />
      ) : (
        <div className="space-y-5">
          {Object.entries(groups).map(([type, docs]) => (
            <Panel key={type} title={docTypeLabel(type)} description={`${docs.length} dokument`}>
              <ul className="space-y-3">
                {docs.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
                  >
                    <div>
                      <p className="text-sm font-medium">📄 {d.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {d.file_kind?.toUpperCase()}
                        {d.file_size ? ` · ${d.file_size}` : ""}
                        {d.units ? ` · Lägenhet ${d.units.unit_number}` : ""}
                        {d.properties?.name ? ` · ${d.properties.name}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{dateLong(d.created_at)}</span>
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
