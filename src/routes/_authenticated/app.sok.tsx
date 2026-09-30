import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  ChevronRight,
  FileText,
  Megaphone,
  Search,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { z } from "zod";

import { searchEverything, type SearchHit } from "@/lib/search.functions";
import { getMe } from "@/lib/app.functions";
import { EmptyState, PageHeader, Panel } from "@/components/ui-kit";
import { ContactPanel } from "@/components/contact-panel";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/app/sok")({
  validateSearch: z.object({ q: z.string().max(100).optional().catch(undefined) }),
  head: () => ({ meta: [{ title: "Sök och hjälp – Boendeplattformen" }] }),
  component: SearchPage,
});

const hitIcons: Record<SearchHit["kind"], typeof Search> = {
  action: Zap,
  resource: CalendarDays,
  document: FileText,
  news: Megaphone,
  request: Wrench,
  meeting: Users,
};

/** Vanliga frågor med svar som gäller i appen. */
const FAQ: { q: string; a: string; to: string; cta: string }[] = [
  {
    q: "Hur bokar jag tvättstugan?",
    a: "Tryck på Boka, välj tvättstuga och en ledig tid, och bekräfta. Du kan avboka under Mina bokningar.",
    to: "/app/bokningar",
    cta: "Boka en tid",
  },
  {
    q: "Något är trasigt – hur gör jag en felanmälan?",
    a: "Tryck på Felanmälan och välj vad det gäller. Beskriv felet och lägg gärna till en bild. Du ser hela tiden hur långt ärendet har kommit.",
    to: "/app/felanmalan",
    cta: "Gör en felanmälan",
  },
  {
    q: "Var hittar jag stadgarna och ordningsreglerna?",
    a: "Alla föreningens dokument finns i Föreningspärmen. Sök på till exempel ”stadgar” eller ”regler”.",
    to: "/app/dokument",
    cta: "Öppna föreningspärmen",
  },
  {
    q: "Får jag hyra ut min lägenhet i andra hand?",
    a: "Det styrs av föreningens stadgar och kräver oftast styrelsens godkännande. Läs stadgarna och skicka en fråga till styrelsen.",
    to: "/app/meddelanden",
    cta: "Fråga styrelsen",
  },
  {
    q: "Hur ändrar jag mitt telefonnummer eller min e-post?",
    a: "Gå till Min profil. Där ändrar du också vilka aviseringar du vill få.",
    to: "/app/profil",
    cta: "Till min profil",
  },
];

function SearchPage() {
  const { q: initial } = Route.useSearch();
  const [q, setQ] = useState(initial ?? "");
  const [debounced, setDebounced] = useState(q);
  const fn = useServerFn(searchEverything);
  const meFn = useServerFn(getMe);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data: hits, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => fn({ data: { q: debounced } }),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const org = me?.organization;

  return (
    <div>
      <PageHeader
        title="Sök och hjälp"
        subtitle="Hitta dokument, nyheter, bokningar och svar på vanliga frågor."
      />

      <form role="search" onSubmit={(e) => e.preventDefault()} className="mb-6">
        <label htmlFor="search" className="mb-2 block text-base font-medium">
          Vad letar du efter?
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="search"
            type="search"
            autoFocus
            autoComplete="off"
            placeholder="T.ex. tvättstuga, stadgar eller vattenläcka"
            className="h-14 pl-12 text-lg"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </form>

      {debounced.length >= 2 ? (
        <section aria-live="polite" className="mb-8">
          {isFetching && !hits ? (
            <p className="text-base text-muted-foreground" role="status">
              Söker…
            </p>
          ) : !hits || hits.length === 0 ? (
            <EmptyState
              title={`Inga träffar på ”${debounced}”`}
              description="Pröva ett annat ord, eller skriv till föreningen så hjälper de dig."
              action={
                <Link to="/app/meddelanden" className="text-base font-medium text-primary">
                  Skriv till föreningen
                </Link>
              }
            />
          ) : (
            <Panel padded={false}>
              <ul className="divide-y divide-border">
                {hits.map((h, i) => {
                  const Icon = hitIcons[h.kind];
                  return (
                    <li key={`${h.kind}-${h.title}-${i}`}>
                      <Link
                        to={h.to}
                        {...(h.params ? { params: h.params } : {})}
                        {...(h.search ? { search: h.search } : {})}
                        className="flex min-h-16 items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-muted"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base font-medium">{h.title}</span>
                          {h.detail ? (
                            <span className="block truncate text-sm text-muted-foreground">
                              {h.detail}
                            </span>
                          ) : null}
                        </span>
                        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Vanliga frågor">
          <div className="space-y-2">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-xl border border-border">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-base font-medium">
                  {f.q}
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground transition group-open:rotate-90" />
                </summary>
                <div className="px-4 pb-4">
                  <p className="text-base text-muted-foreground">{f.a}</p>
                  <Link
                    to={f.to}
                    className="mt-3 inline-flex min-h-10 items-center gap-1 text-base font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {f.cta} <ChevronRight className="size-4" />
                  </Link>
                </div>
              </details>
            ))}
          </div>
        </Panel>

        <ContactPanel org={org ?? null} />
      </div>
    </div>
  );
}
