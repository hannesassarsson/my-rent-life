import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { getAdminMessages, sendMessage } from "@/lib/app.functions";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { authorRoleLabel, dateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/meddelanden")({
  head: () => ({ meta: [{ title: "Meddelanden – Boendeplattformen" }] }),
  component: AdminMessagesPage,
});

type Message = Awaited<ReturnType<typeof getAdminMessages>>["messages"][number];

type Thread = {
  key: string;
  subject: string;
  residentUserId: string | null;
  residentName: string | null;
  messages: Message[];
  last: Message;
  waiting: boolean;
};

function AdminMessagesPage() {
  const fn = useServerFn(getAdminMessages);
  const send = useServerFn(sendMessage);
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["admin-messages"], queryFn: () => fn() });
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ residentUserId: "", subject: "", body: "" });

  const threads = useMemo<Thread[]>(() => {
    if (!data) return [];
    const nameOf = new Map(data.residents.map((r) => [r.user_id, r.resident_name]));
    const byKey = new Map<string, Message[]>();
    for (const m of data.messages) byKey.set(m.thread_key, [...(byKey.get(m.thread_key) ?? []), m]);
    return [...byKey.entries()]
      .map(([key, messages]) => {
        const last = messages[messages.length - 1]!;
        const residentUserId = messages.find((m) => m.resident_user_id)?.resident_user_id ?? null;
        const residentName =
          (residentUserId ? nameOf.get(residentUserId) : null) ??
          messages.find((m) => m.sender_role === "resident")?.sender_name ??
          null;
        return {
          key,
          subject: messages.find((m) => m.subject)?.subject ?? "Meddelande",
          residentUserId,
          residentName,
          messages,
          last,
          waiting: last.sender_role === "resident",
        };
      })
      .sort((a, b) => (a.last.created_at < b.last.created_at ? 1 : -1));
  }, [data]);

  const replyMutation = useMutation({
    mutationFn: (t: Thread) =>
      send({
        data: {
          threadKey: t.key,
          subject: t.subject,
          body: reply,
          ...(t.residentUserId ? { residentUserId: t.residentUserId } : {}),
          ...(t.messages[0]?.request_id ? { requestId: t.messages[0].request_id } : {}),
        },
      }),
    onSuccess: () => {
      setReply("");
      toast.success("Svaret är skickat");
      void qc.invalidateQueries({ queryKey: ["admin-messages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const newMutation = useMutation({
    mutationFn: () =>
      send({
        data: {
          threadKey: `resident:${draft.residentUserId}`,
          subject: draft.subject || "Meddelande från förvaltningen",
          body: draft.body,
          residentUserId: draft.residentUserId,
        },
      }),
    onSuccess: () => {
      setSelected(`resident:${draft.residentUserId}`);
      setDraft({ residentUserId: "", subject: "", body: "" });
      setOpen(false);
      toast.success("Meddelandet är skickat");
      void qc.invalidateQueries({ queryKey: ["admin-messages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || !data) return <LoadingBlock rows={4} />;
  const active = threads.find((t) => t.key === selected) ?? threads[0] ?? null;
  const waitingCount = threads.filter((t) => t.waiting).length;

  return (
    <div>
      <PageHeader
        title="Meddelanden"
        subtitle={
          waitingCount > 0
            ? `${waitingCount} ${waitingCount === 1 ? "tråd väntar" : "trådar väntar"} på svar`
            : "Alla trådar är besvarade"
        }
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Nytt meddelande</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nytt meddelande till boende</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Mottagare</Label>
                  <Select
                    value={draft.residentUserId}
                    onValueChange={(v) => setDraft({ ...draft, residentUserId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Välj boende med konto" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.residents.map((r) => (
                        <SelectItem key={r.id} value={r.user_id!}>
                          {r.resident_name} · {r.units?.address} {r.units?.unit_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Ämne</Label>
                  <Input
                    id="subject"
                    value={draft.subject}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body">Meddelande</Label>
                  <Textarea
                    id="body"
                    rows={5}
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!draft.residentUserId || !draft.body.trim() || newMutation.isPending}
                  onClick={() => newMutation.mutate()}
                >
                  Skicka
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {threads.length === 0 ? (
        <EmptyState title="Inga meddelanden ännu" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <Panel title="Trådar" padded={false}>
            <ul className="divide-y divide-border">
              {threads.map((t) => (
                <li key={t.key}>
                  <button
                    type="button"
                    onClick={() => setSelected(t.key)}
                    className={cn(
                      "w-full px-4 py-3 text-left transition hover:bg-surface-muted",
                      active?.key === t.key && "bg-accent",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{t.residentName ?? t.subject}</p>
                      {t.waiting ? (
                        <span className="size-2 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{t.subject}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {t.last.sender_name}: {t.last.body}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          {active ? (
            <Panel
              title={active.subject}
              description={
                active.residentName ? `Konversation med ${active.residentName}` : "Intern tråd"
              }
            >
              <ul className="space-y-3">
                {active.messages.map((m) => (
                  <li
                    key={m.id}
                    className={
                      m.sender_role === "resident"
                        ? "mr-8 rounded-xl border border-border p-4"
                        : "ml-8 rounded-xl bg-accent p-4"
                    }
                  >
                    <p className="text-xs font-medium">
                      {m.sender_name}{" "}
                      <span className="text-muted-foreground">
                        · {authorRoleLabel(m.sender_role)} · {dateTime(m.created_at)}
                      </span>
                    </p>
                    <p className="mt-1.5 text-sm whitespace-pre-line">{m.body}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-5 space-y-3">
                <Textarea
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={
                    active.residentName ? `Svara ${active.residentName}…` : "Skriv i tråden…"
                  }
                />
                <Button
                  disabled={!reply.trim() || replyMutation.isPending}
                  onClick={() => replyMutation.mutate(active)}
                >
                  {replyMutation.isPending ? "Skickar…" : "Skicka svar"}
                </Button>
              </div>
            </Panel>
          ) : null}
        </div>
      )}
    </div>
  );
}
