import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { getMyKeys, unlockDoor, type UnlockResult } from "@/lib/keys.functions";
import { KeyCard, type KeyCardState } from "@/components/key-card";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { dateLong } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/nycklar")({
  head: () => ({ meta: [{ title: "Nycklar – Boendeplattformen" }] }),
  component: MyKeysPage,
});

const timeFormat = new Intl.DateTimeFormat("sv-SE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function MyKeysPage() {
  const fn = useServerFn(getMyKeys);
  const unlockFn = useServerFn(unlockDoor);
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["my-keys"], queryFn: () => fn() });
  const [card, setCard] = useState<{ state: KeyCardState; message?: string; door?: string }>({
    state: "idle",
  });

  const unlock = useMutation({
    mutationFn: (doorId: string) => unlockFn({ data: { doorId, method: "app" } }),
    onMutate: () => setCard({ state: "working" }),
    onSuccess: (r: UnlockResult) => {
      setCard({
        state: r.result,
        door: r.door,
        message: r.result === "granted" ? `${r.door} är upplåst` : `Nekad: ${r.reason}`,
      });
      void qc.invalidateQueries({ queryKey: ["my-keys"] });
      window.setTimeout(() => setCard({ state: "idle" }), 5000);
    },
    onError: (e: Error) => {
      setCard({ state: "idle" });
      toast.error(e.message);
    },
  });

  if (isPending || !data) return <LoadingBlock rows={4} />;

  const doorName = (id: string) => data.doors.find((d) => d.id === id)?.name ?? "Dörr";
  const mine = data.doors.filter((d) => d.access);
  const others = data.doors.filter((d) => !d.access);

  return (
    <div>
      <PageHeader title="Nycklar" subtitle="Öppna porten och gemensamma utrymmen med telefonen" />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <KeyCard
            name={card.door ?? "Din nyckel"}
            subtitle={`${mine.length} dörrar`}
            state={card.state}
            {...(card.message ? { message: card.message } : {})}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Vid dörren: håll telefonen mot läsaren så öppnas den direkt. Du kan också låsa upp
            härifrån när du står vid dörren.
          </p>
        </div>

        <Panel title="Dina dörrar" className="lg:col-span-3">
          {mine.length === 0 ? (
            <EmptyState title="Du har inga dörrar ännu" />
          ) : (
            <ul className="divide-y divide-border">
              {mine.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.location ?? ""}
                      {d.via ? ` · ${d.via}` : ""}
                      {d.keyUntil ? ` till ${dateLong(d.keyUntil)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!d.is_online ? <StatusPill tone="warning">Läsaren offline</StatusPill> : null}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={unlock.isPending}
                      onClick={() => unlock.mutate(d.id)}
                    >
                      Lås upp
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {others.length > 0 ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Utan behörighet: {others.map((d) => d.name).join(", ")}. Kontakta förvaltningen om du
              behöver komma in.
            </p>
          ) : null}
        </Panel>
      </div>

      <Panel title="Mina senaste passager" className="mt-5">
        {data.events.length === 0 ? (
          <EmptyState title="Inga passager ännu" />
        ) : (
          <ul className="divide-y divide-border">
            {data.events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  {doorName(e.door_id)}
                  <span className="text-muted-foreground">
                    {" "}
                    · {e.method === "nfc" ? "NFC" : "appen"}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {timeFormat.format(new Date(e.created_at))}
                  <StatusPill tone={e.result === "granted" ? "success" : "danger"}>
                    {e.result === "granted" ? "Öppnad" : "Nekad"}
                  </StatusPill>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
