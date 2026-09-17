import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { getMessages, sendMessage } from "@/lib/app.functions";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { dateTime } from "@/lib/format";
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

function MessagesPage() {
  const fn = useServerFn(getMessages);
  const send = useServerFn(sendMessage);
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["messages"], queryFn: () => fn() });
  const [body, setBody] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      send({
        data: {
          threadKey: `resident:${data?.me.userId}`,
          subject: "Fråga från boende",
          body: body.trim(),
        },
      }),
    onSuccess: () => {
      setBody("");
      toast.success("Meddelandet är skickat");
      void qc.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || !data) return <LoadingBlock rows={4} />;

  return (
    <div>
      <PageHeader title="Meddelanden" subtitle="Din direktkontakt med förvaltningen" />

      <Panel title="Konversation">
        {data.messages.length === 0 ? (
          <EmptyState
            title="Inga meddelanden ännu"
            description="Skriv ditt första meddelande nedan."
          />
        ) : (
          <ul className="space-y-3">
            {data.messages.map((m) => (
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
                    · {m.sender_role === "resident" ? "Boende" : "Förvaltning"} ·{" "}
                    {dateTime(m.created_at)}
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
