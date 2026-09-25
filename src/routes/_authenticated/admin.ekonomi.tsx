import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { toast } from "sonner";

import {
  createBilling,
  getAdminEconomy,
  getPaymentsForPeriod,
  markPaymentPaid,
  sendReminders,
} from "@/lib/app.functions";
import { PageHeader, Panel, Kpi, LoadingBlock, EmptyState } from "@/components/ui-kit";
import { PaymentStatusBadge } from "@/components/status-badge";
import { kr, dateLong, monthName } from "@/lib/format";
import { useCan } from "@/lib/use-can";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/ekonomi")({
  component: AdminEconomy,
});

/** Första dagen i månaden, offset månader från nu, som YYYY-MM-01. */
function monthStart(offset: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function toCsv(rows: Record<string, string | number>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const cell = (v: string | number) => {
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Semikolon och BOM så att filen öppnas rätt i svenska Excel.
  return (
    "﻿" +
    [headers.join(";"), ...rows.map((r) => headers.map((h) => cell(r[h] ?? "")).join(";"))].join(
      "\n",
    )
  );
}

function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminEconomy() {
  const fn = useServerFn(getAdminEconomy);
  const markFn = useServerFn(markPaymentPaid);
  const billingFn = useServerFn(createBilling);
  const remindFn = useServerFn(sendReminders);
  const exportFn = useServerFn(getPaymentsForPeriod);
  const can = useCan();
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["admin-economy"], queryFn: () => fn() });
  const [billingPeriod, setBillingPeriod] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-economy"] });

  const mark = useMutation({
    mutationFn: (id: string) => markFn({ data: { id } }),
    onSuccess: async () => {
      toast.success("Betalningen är markerad som betald");
      await refresh();
    },
    onError: () => toast.error("Kunde inte uppdatera betalningen"),
  });

  const billing = useMutation({
    mutationFn: (period: string) => billingFn({ data: { period } }),
    onSuccess: async (res, period) => {
      setBillingPeriod(null);
      toast.success(
        res.created > 0
          ? `${res.created} avier skapade för ${monthName(period)} · ${kr(res.total)}`
          : `Alla lägenheter var redan aviserade för ${monthName(period)}`,
      );
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remind = useMutation({
    mutationFn: (ids: string[]) => remindFn({ data: { ids } }),
    onSuccess: async (res) => {
      toast.success(
        `${res.reminded} ${res.reminded === 1 ? "påminnelse" : "påminnelser"} skickade · ${res.notified} boende notifierade i appen`,
      );
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = useMutation({
    mutationFn: (period: string) => exportFn({ data: { period } }),
    onSuccess: (rows, period) => {
      download(
        `avgifter-${period.slice(0, 7)}.csv`,
        toCsv(
          rows.map((r) => ({
            Period: r.period,
            Adress: r.address,
            Lägenhet: r.unit,
            Objektsnummer: r.objectNumber,
            Boende: r.resident,
            Typ: r.kind,
            Belopp: r.amount,
            Förfallodatum: r.dueDate,
            Status: r.status,
            Betald: r.paidAt,
            Betalsätt: r.paidVia,
            Påmind: r.remindedAt,
          })),
        ),
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const latest = data?.periods.find((p) => p.period <= monthStart(0)) ?? data?.periods[0];
  const rate = latest && latest.count > 0 ? Math.round((latest.paidCount / latest.count) * 100) : 0;
  const unpaid = data?.unpaid ?? [];
  const overdue = unpaid.filter((r) => r.due_date < new Date().toISOString().slice(0, 10));
  const outstanding = unpaid.reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div>
      <PageHeader
        title="Ekonomi"
        subtitle="Avgifter och hyror per månad"
        action={
          can("economy.edit") ? (
            <Button onClick={() => setBillingPeriod(monthStart(1))}>Skapa avisering</Button>
          ) : null
        }
      />

      {isPending ? (
        <LoadingBlock rows={5} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Kpi
              label="Fakturerat innevarande period"
              value={kr(latest?.billed ?? 0)}
              hint={latest ? monthName(latest.period) : undefined}
            />
            <Kpi
              label="Betalningsgrad"
              value={`${rate}%`}
              tone={rate >= 95 ? "success" : rate >= 85 ? "warning" : "danger"}
              hint={latest ? `${latest.paidCount} av ${latest.count} betalda` : undefined}
            />
            <Kpi
              label="Utestående"
              value={kr(outstanding)}
              tone={overdue.length > 0 ? "danger" : outstanding > 0 ? "warning" : "success"}
              hint={`${unpaid.length} obetalda · ${overdue.length} förfallna`}
            />
          </div>

          <Panel title="Per månad" padded={false}>
            <ul className="divide-y divide-border">
              {(data?.periods ?? []).map((p) => {
                const pct = p.count > 0 ? Math.round((p.paidCount / p.count) * 100) : 0;
                return (
                  <li key={p.period} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <div className="w-32 text-sm font-medium">{monthName(p.period)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {p.paidCount} av {p.count} betalda · {pct}%
                      </p>
                    </div>
                    <div className="text-right text-sm tnum">
                      <p className="font-medium">{kr(p.paid)}</p>
                      <p className="text-xs text-muted-foreground">av {kr(p.billed)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Exportera ${monthName(p.period)} som CSV`}
                      disabled={exportCsv.isPending}
                      onClick={() => exportCsv.mutate(p.period)}
                    >
                      <Download /> CSV
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel
            title="Obetalda poster"
            description="Skicka påminnelse eller markera som betald när betalningen är bokförd"
            action={
              can("economy.edit") && overdue.length > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={remind.isPending}
                  onClick={() => remind.mutate(overdue.map((r) => r.id))}
                >
                  Påminn alla förfallna ({overdue.length})
                </Button>
              ) : null
            }
          >
            {unpaid.length === 0 ? (
              <EmptyState title="Allt är betalt" description="Inga utestående poster just nu." />
            ) : (
              <ul className="divide-y divide-border">
                {unpaid.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {r.units?.address} · {r.units?.unit_number}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {monthName(r.period as string)} · förfaller {dateLong(r.due_date)}
                        {r.reminded_at ? ` · påmind ${dateLong(r.reminded_at)}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-medium tnum">{kr(Number(r.amount))}</span>
                    <PaymentStatusBadge status={r.status as string} />
                    {can("economy.edit") ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={remind.isPending}
                          onClick={() => remind.mutate([r.id])}
                        >
                          Påminn
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={mark.isPending}
                          onClick={() => mark.mutate(r.id)}
                        >
                          Markera betald
                        </Button>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Betalsätt för boende"
            description="Boende betalar sina avier under Ekonomi i appen. Demoläge: inga riktiga pengar dras."
          >
            <ul className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Kort", hint: "Kortbetalning med automatisk avprickning" },
                { label: "Swish", hint: "Swish-betalning direkt i mobilen" },
                { label: "Banköverföring", hint: "Bankgiro med OCR-nummer" },
              ].map((m) => (
                <li key={m.label} className="rounded-xl border border-border p-4">
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{m.hint}</p>
                  <span className="mt-3 inline-flex rounded-full bg-success/10 px-2.5 py-1 text-xs text-success">
                    Aktiv i demoläge
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Bokföring"
            description="Exportera en period och läs in den i Fortnox, Visma eller annat bokföringsprogram."
          >
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Export för bokföring</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  CSV med lägenhet, boende, belopp, förfallodatum, status, betalsätt och
                  påminnelser. En direktkoppling till Fortnox är planerad.
                </p>
              </div>
              <Button
                variant="outline"
                disabled={!latest || exportCsv.isPending}
                onClick={() => latest && exportCsv.mutate(latest.period)}
              >
                <Download /> Exportera {latest ? monthName(latest.period) : ""}
              </Button>
            </div>
          </Panel>
        </div>
      )}

      <Dialog open={!!billingPeriod} onOpenChange={(v) => !v && setBillingPeriod(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skapa avisering</DialogTitle>
          </DialogHeader>
          {billingPeriod ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Avgifter och hyror skapas för alla uthyrda lägenheter som inte redan är aviserade
                för månaden, med lägenhetens månadsbelopp och sista dagen i månaden som
                förfallodatum.
              </p>
              <div className="space-y-2">
                <Label>Månad</Label>
                <Select value={billingPeriod} onValueChange={setBillingPeriod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3].map((offset) => {
                      const value = monthStart(offset);
                      return (
                        <SelectItem key={value} value={value}>
                          {monthName(value)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                disabled={billing.isPending}
                onClick={() => billing.mutate(billingPeriod)}
              >
                {billing.isPending ? "Skapar…" : `Avisera ${monthName(billingPeriod)}`}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
