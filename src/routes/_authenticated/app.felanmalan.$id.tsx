import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { addRequestComment, getRequestDetail } from "@/lib/app.functions";
import { DataRow, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { PriorityBadge, RequestStatusBadge } from "@/components/status-badge";
import { dateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/app/felanmalan/$id")({
  head: () => ({
    meta: [
      { title: "Mitt ärende – Boendeplattformen" },
      { name: "description", content: "Följ ditt ärende: status, tidslinje och svar från förvaltningen." },
      { property: "og:title", content: "Mitt ärende – Boendeplattformen" },
      { property: "og:description", content: "Följ status och kommunikation för ditt ärende." },
    ],
  }),
  component: RequestPage,
});

function RequestPage() {
  const { id } = Route.useParams();
  const fn = useServerFn(getRequestDetail);
  const comment = useServerFn(addRequestComment);
  const qc = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["request", id],
    queryFn: () => fn({ data: { id } }),
  });
  const [body, setBody] = useState("");

  const mutation = useMutation({
    mutationFn: (action?: "still_broken" | "resolved") =>
      comment({ data: { requestId: id, body, ...(action ? { action } : {}) } }),
    onSuccess: () => {
      setBody("");
      toast.success("Skickat till förvaltningen");
      void qc.invalidateQueries({ queryKey: ["request", id] });
      void qc.invalidateQueries({ queryKey: ["my-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || !data) return <LoadingBlock rows={4} />;
  const r = data.request;

  return (
    <div>
      <Link
        to="/app/felanmalan"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Tillbaka till mina ärenden
      </Link>
      <PageHeader
        title={r.title}
        subtitle={`Ärende #${r.ticket_number} · ${r.category}${r.room ? ` · ${r.room}` : ""}`}
        action={
          <div className="flex items-center gap-2">
            <PriorityBadge priority={r.priority} />
            <RequestStatusBadge status={r.status} />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel title="Din beskrivning">
            <p className="text-sm whitespace-pre-line text-muted-foreground">
              {r.description || "Ingen beskrivning lämnad."}
            </p>
          </Panel>

          <Panel title="Tidslinje">
            <ol className="space-y-4">
              {data.events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm font-medium">{e.label}</p>
                    <p className="text-xs text-muted-foreground">{dateTime(e.created_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Kommunikation">
            <ul className="space-y-3">
              {data.comments.map((c) => (
                <li
                  key={c.id}
                  className={
                    c.author_role === "resident"
                      ? "ml-8 rounded-xl bg-accent p-4"
                      : "mr-8 rounded-xl border border-border p-4"
                  }
                >
                  <p className="text-xs font-medium">
                    {c.author_name}{" "}
                    <span className="text-muted-foreground">
                      · {c.author_role === "resident" ? "Boende" : "Förvaltning"} ·{" "}
                      {dateTime(c.created_at)}
                    </span>
                  </p>
                  <p className="mt-1.5 text-sm whitespace-pre-line">{c.body}</p>
                </li>
              ))}
            </ul>

            <div className="mt-5 space-y-3">
              <Textarea
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Skriv ett meddelande till förvaltningen…"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!body.trim() || mutation.isPending}
                  onClick={() => mutation.mutate(undefined)}
                >
                  Skicka
                </Button>
                <Button
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate("still_broken")}
                >
                  Problemet kvarstår
                </Button>
                <Button
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate("resolved")}
                >
                  Problemet är löst
                </Button>
              </div>
            </div>
          </Panel>
        </div>

        <Panel title="Uppgifter">
          <dl>
            <DataRow label="Anmält" value={dateTime(r.created_at)} />
            <DataRow label="Senast uppdaterat" value={dateTime(r.updated_at)} />
            <DataRow label="Akut" value={r.is_urgent ? "Ja" : "Nej"} />
            <DataRow label="Ansvarig" value={r.assignee_name ?? "Inte tilldelat"} />
            <DataRow label="Entreprenör" value={r.contractors?.company ?? "–"} />
            {r.contractors?.phone ? (
              <DataRow label="Telefon" value={r.contractors.phone} />
            ) : null}
            <DataRow
              label="Bostad"
              value={r.units ? `${r.units.unit_number} · ${r.units.address}` : "–"}
            />
          </dl>
        </Panel>
      </div>
    </div>
  );
}
