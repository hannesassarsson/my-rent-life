import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { getRequestDetail, updateContractorJob } from "@/lib/app.functions";
import { DataRow, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { PriorityBadge, RequestStatusBadge } from "@/components/status-badge";
import { authorRoleLabel, dateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/entreprenor/$id")({
  head: () => ({ meta: [{ title: "Uppdrag – Boendeplattformen" }] }),
  component: JobPage,
});

type Update = {
  status?: "booked" | "in_progress" | "resolved";
  scheduledAt?: string;
  note?: string;
};

function JobPage() {
  const { id } = Route.useParams();
  const fn = useServerFn(getRequestDetail);
  const update = useServerFn(updateContractorJob);
  const qc = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["request", id],
    queryFn: () => fn({ data: { id } }),
  });
  const [note, setNote] = useState("");
  const [when, setWhen] = useState("");

  const mutation = useMutation({
    mutationFn: (v: Update) => update({ data: { id, ...v } }),
    onSuccess: () => {
      setNote("");
      setWhen("");
      toast.success("Uppdraget är uppdaterat");
      void qc.invalidateQueries({ queryKey: ["request", id] });
      void qc.invalidateQueries({ queryKey: ["contractor-jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || !data) return <LoadingBlock rows={4} />;
  const r = data.request;
  const closed = r.status === "resolved" || r.status === "closed";

  return (
    <div>
      <Link
        to="/entreprenor"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Tillbaka till mina uppdrag
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
          <Panel title="Beskrivning från boende">
            <p className="text-sm whitespace-pre-line text-muted-foreground">
              {r.description || "Ingen beskrivning lämnad."}
            </p>
          </Panel>

          {!closed ? (
            <Panel title="Hantera uppdraget">
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="when">Boka tid hos den boende</Label>
                  <Input
                    id="when"
                    type="datetime-local"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  disabled={!when || mutation.isPending}
                  onClick={() => mutation.mutate({ scheduledAt: new Date(when).toISOString() })}
                >
                  Boka tid
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={r.status === "in_progress" || mutation.isPending}
                  onClick={() => mutation.mutate({ status: "in_progress" })}
                >
                  Påbörja arbetet
                </Button>
                <Button
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({ status: "resolved", ...(note.trim() ? { note } : {}) })
                  }
                >
                  Markera som åtgärdat
                </Button>
              </div>
            </Panel>
          ) : null}

          <Panel title="Kommunikation">
            <ul className="space-y-3">
              {data.comments.map((c) => (
                <li
                  key={c.id}
                  className={
                    c.author_role === "contractor"
                      ? "ml-8 rounded-xl bg-accent p-4"
                      : "mr-8 rounded-xl border border-border p-4"
                  }
                >
                  <p className="text-xs font-medium">
                    {c.author_name}{" "}
                    <span className="text-muted-foreground">
                      · {authorRoleLabel(c.author_role)} · {dateTime(c.created_at)}
                    </span>
                  </p>
                  <p className="mt-1.5 text-sm whitespace-pre-line">{c.body}</p>
                </li>
              ))}
            </ul>
            <div className="mt-5 space-y-3">
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Skriv till den boende och förvaltningen…"
              />
              <Button
                disabled={!note.trim() || mutation.isPending}
                onClick={() => mutation.mutate({ note })}
              >
                Skicka
              </Button>
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Uppgifter">
            <dl>
              <DataRow
                label="Adress"
                value={r.units ? `${r.units.address}, ${r.units.unit_number}` : "–"}
              />
              <DataRow label="Anmält av" value={r.reporter_name ?? "–"} />
              <DataRow label="Anmält" value={dateTime(r.created_at)} />
              <DataRow label="Akut" value={r.is_urgent ? "Ja" : "Nej"} />
              <DataRow label="Kontakt hos förvaltningen" value={r.assignee_name ?? "–"} />
            </dl>
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
        </div>
      </div>
    </div>
  );
}
