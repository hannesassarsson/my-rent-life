import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { getAdminEconomy, markPaymentPaid } from "@/lib/app.functions";
import { PageHeader, Panel, Kpi, LoadingBlock, EmptyState } from "@/components/ui-kit";
import { PaymentStatusBadge } from "@/components/status-badge";
import { kr, dateLong, monthName } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/ekonomi")({
  component: AdminEconomy,
});

function AdminEconomy() {
  const fn = useServerFn(getAdminEconomy);
  const markFn = useServerFn(markPaymentPaid);
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["admin-economy"], queryFn: () => fn() });

  const mark = useMutation({
    mutationFn: (id: string) => markFn({ data: { id } }),
    onSuccess: async () => {
      toast.success("Betalningen är markerad som betald");
      await queryClient.invalidateQueries({ queryKey: ["admin-economy"] });
    },
    onError: () => toast.error("Kunde inte uppdatera betalningen"),
  });

  const latest = data?.periods[0];
  const rate = latest && latest.count > 0 ? Math.round((latest.paidCount / latest.count) * 100) : 0;
  const outstanding = (data?.unpaid ?? []).reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div>
      <PageHeader title="Ekonomi" subtitle="Avgifter och hyror per månad" />

      {isPending ? (
        <LoadingBlock rows={5} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Kpi
              label="Fakturerat senaste period"
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
              tone={outstanding > 0 ? "warning" : "success"}
              hint={`${data?.unpaid.length ?? 0} obetalda poster`}
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
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Obetalda poster" description="Markera som betald när betalningen är bokförd">
            {(data?.unpaid ?? []).length === 0 ? (
              <EmptyState title="Allt är betalt" description="Inga utestående poster just nu." />
            ) : (
              <ul className="divide-y divide-border">
                {data!.unpaid.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {r.units?.address} · {r.units?.unit_number}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {monthName(r.period as string)} · förfaller {dateLong(r.due_date)}
                      </p>
                    </div>
                    <span className="text-sm font-medium tnum">{kr(Number(r.amount))}</span>
                    <PaymentStatusBadge status={r.status as string} />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mark.isPending}
                      onClick={() => mark.mutate(r.id)}
                    >
                      Markera betald
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
