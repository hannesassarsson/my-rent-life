import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getAnnouncements } from "@/lib/app.functions";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { announcementCategory, dateLong } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/information")({
  head: () => ({
    meta: [
      { title: "Information – Boendeplattformen" },
      {
        name: "description",
        content: "Nyheter, driftinfo och viktiga meddelanden för ditt boende.",
      },
      { property: "og:title", content: "Information – Boendeplattformen" },
      { property: "og:description", content: "Nyheter och driftinfo för ditt boende." },
    ],
  }),
  component: InformationPage,
});

function InformationPage() {
  const fn = useServerFn(getAnnouncements);
  const { data, isPending } = useQuery({ queryKey: ["announcements"], queryFn: () => fn() });
  const [filter, setFilter] = useState("alla");

  const categories = ["alla", ...new Set((data ?? []).map((a) => a.category))];
  const list = (data ?? []).filter((a) => filter === "alla" || a.category === filter);
  const pinned = list.filter((a) => a.is_pinned);
  const rest = list.filter((a) => !a.is_pinned);

  return (
    <div>
      <PageHeader title="Nyheter" subtitle="Nyheter och viktig information från föreningen" />

      <div className="mb-5 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            aria-pressed={filter === c}
            className={cn(
              "min-h-10 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-primary",
              filter === c && "border-primary bg-accent",
            )}
          >
            {c === "alla" ? "Alla" : announcementCategory(c)}
          </button>
        ))}
      </div>

      {isPending ? (
        <LoadingBlock rows={4} />
      ) : list.length === 0 ? (
        <EmptyState
          title="Inga nyheter just nu"
          description="När föreningen publicerar något visas det här, och du får en notis."
        />
      ) : (
        <div className="space-y-5">
          {[...pinned, ...rest].map((a) => (
            <Panel key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{a.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {announcementCategory(a.category)} · {dateLong(a.published_at)}
                    {a.audience_scope === "building" && a.buildings?.name
                      ? ` · Hus ${a.buildings.name}`
                      : a.properties?.name
                        ? ` · ${a.properties.name}`
                        : ""}
                    {a.updated_at ? ` · Uppdaterad ${dateLong(a.updated_at)}` : ""}
                  </p>
                </div>
                {a.is_pinned ? <StatusPill tone="info">Viktigt</StatusPill> : null}
              </div>
              <p className="mt-3 text-[0.9375rem] leading-relaxed whitespace-pre-line text-foreground/85">
                {a.body}
              </p>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
