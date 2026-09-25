import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { getDeliveryAdmin, saveOrgDeliverySettings } from "@/lib/notify.functions";
import { DataRow, EmptyState, LoadingBlock, Panel } from "@/components/ui-kit";
import { DeliveryStatusPill, StatusPill } from "@/components/status-badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { dateTime } from "@/lib/format";

const channelLabel: Record<string, string> = { email: "E-post", sms: "Sms" };

/** Utskick på e-post och sms: status, föreningens val och logg. */
export function DeliveryAdmin() {
  const fn = useServerFn(getDeliveryAdmin);
  const saveFn = useServerFn(saveOrgDeliverySettings);
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["delivery-admin"], queryFn: () => fn() });

  const save = useMutation({
    mutationFn: (smsEnabled: boolean) => saveFn({ data: { smsEnabled } }),
    onSuccess: (_r, smsEnabled) => {
      toast.success(smsEnabled ? "Sms är påslaget" : "Sms är avstängt");
      void qc.invalidateQueries({ queryKey: ["delivery-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || !data) return <LoadingBlock rows={2} />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Panel
        title="Utskick"
        description="Notiser i appen skickas också som e-post och sms enligt varje persons val."
      >
        <dl>
          <DataRow
            label="E-post"
            value={
              <StatusPill tone={data.channels.email ? "success" : "neutral"}>
                {data.channels.email ? "Aktiverat" : "Inte aktiverat"}
              </StatusPill>
            }
          />
          <DataRow
            label="Sms"
            value={
              <StatusPill tone={data.channels.sms ? "success" : "neutral"}>
                {data.channels.sms ? "Aktiverat" : "Inte aktiverat"}
              </StatusPill>
            }
          />
          <DataRow
            label="Senaste 30 dagarna"
            value={`${data.stats.email.sent} mejl · ${data.stats.sms.sent} sms`}
          />
          {data.stats.email.failed + data.stats.sms.failed > 0 ? (
            <DataRow
              label="Misslyckade"
              value={
                <span className="text-danger">
                  {data.stats.email.failed + data.stats.sms.failed}
                </span>
              }
            />
          ) : null}
        </dl>
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-border p-4">
          <div className="min-w-0 flex-1">
            <Label htmlFor="org-sms" className="text-sm font-medium">
              Sms till boende
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Avier, påminnelser, felanmälningar och annat som rör den boende direkt. Varje boende
              väljer själv om de vill ha sms. Ett sms kostar omkring 50 öre.
            </p>
          </div>
          <Switch
            id="org-sms"
            checked={data.smsEnabled}
            disabled={save.isPending}
            onCheckedChange={(v) => save.mutate(v)}
          />
        </div>
        {data.isDemo ? (
          <p className="mt-4 rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
            Demoföreningen skickar inga riktiga mejl eller sms. Utskicken loggas men går inte iväg.
          </p>
        ) : null}
      </Panel>

      <Panel title="Utskickslogg" description="De 100 senaste utskicken" padded={false}>
        {data.log.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Inga utskick ännu"
              description="När något publiceras eller besvaras skickas det här."
            />
          </div>
        ) : (
          <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
            {data.log.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.notifications?.title ?? "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {channelLabel[d.channel] ?? d.channel} till {d.name ?? d.recipient} ·{" "}
                    {dateTime(d.sent_at ?? d.created_at)}
                  </p>
                  {d.error && d.status !== "sent" ? (
                    <p className="truncate text-xs text-muted-foreground" title={d.error}>
                      {d.error}
                    </p>
                  ) : null}
                </div>
                <DeliveryStatusPill status={d.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
