import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, MessageSquareText, Send } from "lucide-react";
import { toast } from "sonner";

import {
  getMyNotificationSettings,
  saveMyNotificationSettings,
  sendTestNotification,
} from "@/lib/notify.functions";
import { updateMyContact } from "@/lib/app.functions";
import { DataRow, EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { DeliveryStatusPill, deliveryStatusLabels } from "@/components/status-badge";
import { BankIdPanel } from "@/components/bankid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { dateTime } from "@/lib/format";
import { errorMessage } from "@/lib/errors";

const channelLabel = { email: "E-post", sms: "Sms" } as Record<string, string>;

export function ProfilePage() {
  const getFn = useServerFn(getMyNotificationSettings);
  const saveFn = useServerFn(saveMyNotificationSettings);
  const testFn = useServerFn(sendTestNotification);
  const contactFn = useServerFn(updateMyContact);
  const qc = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["notification-settings"],
    queryFn: () => getFn(),
  });
  const [form, setForm] = useState<{
    emailEnabled: boolean;
    smsEnabled: boolean;
    phone: string;
    fullName: string;
  } | null>(null);

  useEffect(() => {
    if (data && !form) {
      setForm({
        emailEnabled: data.emailEnabled,
        smsEnabled: data.smsEnabled,
        phone: data.phone ?? "",
        fullName: data.fullName ?? "",
      });
    }
  }, [data, form]);

  const save = useMutation({
    mutationFn: (d: { emailEnabled: boolean; smsEnabled: boolean; phone: string }) =>
      saveFn({ data: d }),
    onSuccess: (res) => {
      toast.success("Dina val för aviseringar är sparade");
      setForm((f) => (f ? { ...f, phone: res.phone ?? "" } : f));
      void qc.invalidateQueries({ queryKey: ["notification-settings"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
  });

  const saveContact = useMutation({
    mutationFn: (d: { fullName: string; phone: string }) => contactFn({ data: d }),
    onSuccess: () => {
      toast.success("Dina kontaktuppgifter är sparade");
      void qc.invalidateQueries({ queryKey: ["notification-settings"] });
      void qc.invalidateQueries({ queryKey: ["my-home"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
  });

  const test = useMutation({
    mutationFn: () => testFn(),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["notification-settings"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      if (res.deliveries.length === 0) {
        toast.info("Testaviseringen finns under klockan. Du har varken e-post eller sms påslaget.");
        return;
      }
      const summary = res.deliveries
        .map(
          (d) =>
            `${channelLabel[d.channel] ?? d.channel}: ${deliveryStatusLabels[d.status]?.toLowerCase() ?? d.status}`,
        )
        .join(", ");
      const failed = res.deliveries.find((d) => d.status === "failed" || d.status === "skipped");
      if (failed) toast.warning(`${summary}. ${failed.error ?? ""}`);
      else toast.success(summary);
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
  });

  const dirty =
    !!data &&
    !!form &&
    (form.emailEnabled !== data.emailEnabled || form.smsEnabled !== data.smsEnabled);
  const contactDirty =
    !!data &&
    !!form &&
    (form.fullName.trim() !== (data.fullName ?? "") || form.phone !== (data.phone ?? ""));

  return (
    <div>
      <PageHeader
        title="Min profil"
        subtitle="Dina kontaktuppgifter, inloggning och hur du vill få besked"
      />
      {isPending || !data || !form ? (
        <LoadingBlock rows={4} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Panel
              title="Kontaktuppgifter"
              description="Föreningen och hantverkare använder dem när de behöver nå dig."
            >
              <dl>
                <DataRow label="E-post" value={data.email ?? "—"} />
              </dl>
              <div className="mt-4 space-y-2">
                <Label htmlFor="full-name">Namn</Label>
                <Input
                  id="full-name"
                  autoComplete="name"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                />
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="phone">Mobilnummer</Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Till exempel 070-123 45 67"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <Button
                className="mt-5"
                disabled={!contactDirty || !form.fullName.trim() || saveContact.isPending}
                onClick={() =>
                  saveContact.mutate({ fullName: form.fullName.trim(), phone: form.phone.trim() })
                }
              >
                {saveContact.isPending ? "Sparar…" : "Spara kontaktuppgifter"}
              </Button>
            </Panel>

            <BankIdPanel />
          </div>

          <div className="space-y-6">
            <Panel
              title="Aviseringar"
              description="Välj om du också vill få besked på e-post eller sms. Allt syns alltid under klockan i appen."
            >
              <div className="space-y-5">
                <ChannelSwitch
                  id="email"
                  icon={Mail}
                  label="E-post"
                  description={`Allt: avier, svar på felanmälningar, meddelanden, nyheter och möten${data.email ? `, till ${data.email}` : ""}.`}
                  checked={form.emailEnabled}
                  onChange={(v) => setForm({ ...form, emailEnabled: v })}
                />
                <ChannelSwitch
                  id="sms"
                  icon={MessageSquareText}
                  label="Sms"
                  description={
                    data.orgSmsEnabled
                      ? "Bara det som rör dig direkt: avier och påminnelser, felanmälningar, meddelanden, din lägenhet och nycklar."
                      : "Din förening har inte slagit på sms ännu."
                  }
                  checked={form.smsEnabled}
                  disabled={!data.orgSmsEnabled && !form.smsEnabled}
                  onChange={(v) => setForm({ ...form, smsEnabled: v })}
                />
                {data.isDemo ? (
                  <p className="rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
                    Demoföreningen skickar inga riktiga mejl eller sms. Aviseringarna syns nedan men
                    går inte iväg.
                  </p>
                ) : !data.channels.email ? (
                  <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-foreground">
                    E-post kan inte skickas ännu. Kontakta föreningen om du vill ha besked på
                    e-post.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button disabled={!dirty || save.isPending} onClick={() => save.mutate(form)}>
                    {save.isPending ? "Sparar…" : "Spara val för aviseringar"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={dirty || test.isPending}
                    onClick={() => test.mutate()}
                  >
                    <Send className="size-4" />
                    {test.isPending ? "Skickar…" : "Skicka en testavisering"}
                  </Button>
                </div>
              </div>
            </Panel>

            <Panel title="Senaste aviseringar till dig" padded={false}>
              {data.recent.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="Du har inte fått några aviseringar ännu" />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {data.recent.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {d.notifications?.title ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {channelLabel[d.channel] ?? d.channel} ·{" "}
                          {dateTime(d.sent_at ?? d.created_at)}
                        </p>
                      </div>
                      <DeliveryStatusPill status={d.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function ChannelSwitch({
  id,
  icon: Icon,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <Label htmlFor={`channel-${id}`} className="text-sm font-medium">
          {label}
        </Label>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={`channel-${id}`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}
