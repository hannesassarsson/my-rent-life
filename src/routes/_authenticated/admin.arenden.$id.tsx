import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import {
  getRequestDetail,
  updateRequestAdmin,
  getContractors,
  type RequestPriority,
  type RequestStatus,
} from "@/lib/app.functions";
import { PageHeader, Panel, DataRow, LoadingBlock, EmptyState } from "@/components/ui-kit";
import { PriorityBadge, RequestStatusBadge } from "@/components/status-badge";
import { authorRoleLabel, dateTime, priorityLabels, requestStatusLabels } from "@/lib/format";
import { useCan } from "@/lib/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/arenden/$id")({
  component: AdminRequestDetail,
});

function AdminRequestDetail() {
  const { id } = useParams({ from: "/_authenticated/admin/arenden/$id" });
  const detailFn = useServerFn(getRequestDetail);
  const contractorsFn = useServerFn(getContractors);
  const updateFn = useServerFn(updateRequestAdmin);
  const queryClient = useQueryClient();
  const can = useCan();

  const { data, isPending } = useQuery({
    queryKey: ["request", id],
    queryFn: () => detailFn({ data: { id } }),
  });
  const { data: contractorData } = useQuery({
    queryKey: ["contractors"],
    queryFn: () => contractorsFn(),
  });

  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateFn>[0]["data"]) => updateFn({ data: payload }),
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["request", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("Ärendet uppdaterades");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Kunde inte spara"),
  });

  if (isPending) return <LoadingBlock rows={5} />;
  if (!data?.request) return <EmptyState title="Ärendet hittades inte" />;

  const r = data.request;
  const currentAssignee = assignee ?? r.assignee_name ?? "";

  return (
    <div>
      <Link
        to="/admin/arenden"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Alla ärenden
      </Link>

      <PageHeader
        title={r.title}
        subtitle={`Ärende #${r.ticket_number} · ${r.category} · ${r.units?.address ?? "—"} ${r.units?.unit_number ?? ""}`}
        action={
          <div className="flex gap-2">
            <PriorityBadge priority={r.priority as string} />
            <RequestStatusBadge status={r.status as string} />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Panel title="Beskrivning">
            <p className="text-sm whitespace-pre-line">{r.description || "Ingen beskrivning."}</p>
            <dl className="mt-4">
              <DataRow label="Anmäld av" value={r.reporter_name ?? "—"} />
              <DataRow label="Rum" value={r.room ?? "—"} />
              <DataRow label="Inkom" value={dateTime(r.created_at)} />
              {r.resolved_at ? <DataRow label="Löst" value={dateTime(r.resolved_at)} /> : null}
            </dl>
          </Panel>

          <Panel title="Tidslinje">
            {data.events.length === 0 ? (
              <EmptyState title="Inga händelser ännu" />
            ) : (
              <ol className="space-y-4">
                {data.events.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    <div>
                      <p className="text-sm">{e.label}</p>
                      <p className="text-xs text-muted-foreground">{dateTime(e.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="Kommunikation med boende">
            {data.comments.length === 0 ? (
              <EmptyState title="Inga meddelanden" />
            ) : (
              <ul className="space-y-3">
                {data.comments.map((c) => (
                  <li key={c.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">
                        {c.author_name}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {authorRoleLabel(c.author_role)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">{dateTime(c.created_at)}</p>
                    </div>
                    <p className="mt-1.5 text-sm whitespace-pre-line">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
            {can("requests.edit") ? (
              <div className="mt-4 space-y-2">
                <Label htmlFor="note">Svara boende</Label>
                <Textarea
                  id="note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Skriv ett svar eller en statusuppdatering…"
                />
                <Button
                  disabled={!note.trim() || mutation.isPending}
                  onClick={() => mutation.mutate({ id, note })}
                >
                  Skicka svar
                </Button>
              </div>
            ) : null}
          </Panel>
        </div>

        <div className="space-y-5">
          {can("requests.edit") ? (
            <Panel title="Handlägg ärendet">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={r.status as string}
                    onValueChange={(value) =>
                      mutation.mutate({ id, status: value as RequestStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(requestStatusLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Prioritet</Label>
                  <Select
                    value={r.priority as string}
                    onValueChange={(value) =>
                      mutation.mutate({ id, priority: value as RequestPriority })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Entreprenör</Label>
                  <Select
                    value={r.contractors?.id ?? "none"}
                    onValueChange={(value) =>
                      mutation.mutate({ id, contractorId: value === "none" ? null : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Välj entreprenör" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen</SelectItem>
                      {(contractorData?.contractors ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.company}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignee">Ansvarig</Label>
                  <div className="flex gap-2">
                    <Input
                      id="assignee"
                      value={currentAssignee}
                      onChange={(e) => setAssignee(e.target.value)}
                      placeholder="Namn"
                    />
                    <Button
                      variant="secondary"
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ id, assigneeName: currentAssignee || null })}
                    >
                      Spara
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button
                    variant="secondary"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ id, status: "in_progress" })}
                  >
                    Markera pågående
                  </Button>
                  <Button
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ id, status: "resolved" })}
                  >
                    Markera löst
                  </Button>
                </div>
              </div>
            </Panel>
          ) : null}

          {r.contractors ? (
            <Panel title="Tilldelad entreprenör">
              <dl>
                <DataRow label="Företag" value={r.contractors.company} />
                <DataRow label="Kontakt" value={r.contractors.contact_name ?? "—"} />
                <DataRow label="Telefon" value={r.contractors.phone ?? "—"} />
                <DataRow label="E-post" value={r.contractors.email ?? "—"} />
              </dl>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
