import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { getMessages, sendMessage } from "@/lib/app.functions";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { authorRoleLabel, dateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/app/meddelanden")({
  head: () => ({
    meta: [
      { title: "Meddelanden – Boendeplattformen" },
      { name: "description", content: "Skriv direkt till förvaltningen och läs deras svar." },
      { property: "og:title", content: "Meddelanden – Boendeplattformen" },
      { property: "og:description", content: "Direktkontakt med din förvaltning." },
    ],
  }),
  component: MessagesPage,
});

type Message = Awaited<ReturnType<typeof getMessages>>["messages"][number];

function MessagesPage() {
  const fn = useServerFn(getMessages);
  const send = useServerFn(sendMessage);
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["messages"], queryFn: () => fn() });
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const ownKey = data ? `resident:${data.me.userId}` : "";
  const threads = useMemo(() => {
    if (!data) return [];
    const byKey = new Map<string, Message[]>([[ownKey, []]]);
    for (const m of data.messages) byKey.set(m.thread_key, [...(byKey.get(m.thread_key) ?? []), m]);
    return [...byKey.entries()].map(([key, messages]) => ({
      key,
      subject:
        key === ownKey
          ? "Förvaltningen"
          : (messages.find((m) => m.subject)?.subject ?? "Meddelande"),
      messages,
      requestId: messages.find((m) => m.request_id)?.request_id ?? null,
    }));
  }, [data, ownKey]);

  const active = threads.find((t) => t.key === selected) ?? threads[0];

  const mutation = useMutation({
    mutationFn: () =>
      send({
        data: {
          threadKey: active!.key,
          subject: active!.key === ownKey ? "Fråga från boende" : active!.subject,
          body: body.trim(),
          ...(active!.requestId ? { requestId: active!.requestId } : {}),
        },
      }),
    onSuccess: () => {
      setBody("");
      toast.success("Meddelandet är skickat");
      void qc.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || !data || !active) return <LoadingBlock rows={4} />;

  return (
    <div>
      <PageHeader title="Meddelanden" subtitle="Din direktkontakt med förvaltningen" />

      {threads.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {threads.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSelected(t.key)}
              className={cn(
                "rounded-full border border-border px-3 py-1.5 text-sm transition hover:border-primary",
                active.key === t.key && "border-primary bg-accent font-medium",
              )}
            >
              {t.subject}
            </button>
          ))}
        </div>
      ) : null}

      <Panel title={active.subject}>
        {active.messages.length === 0 ? (
          <EmptyState
            title="Inga meddelanden ännu"
            description="Skriv ditt första meddelande nedan."
          />
        ) : (
          <ul className="space-y-3">
            {active.messages.map((m) => (
              <li
                key={m.id}
                className={
                  m.sender_role === "resident"
                    ? "ml-8 rounded-xl bg-accent p-4"
                    : "mr-8 rounded-xl border border-border p-4"
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
        )}

        <div className="mt-5 space-y-3">
          <Textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Skriv ett meddelande till förvaltningen…"
          />
          <Button disabled={!body.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Skickar…" : "Skicka"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
