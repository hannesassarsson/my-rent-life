import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMyEconomy } from "@/lib/app.functions";
import { EmptyState, Kpi, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { PaymentStatusBadge } from "@/components/status-badge";
import { PayDialog } from "@/components/pay-dialog";
import { dateLong, kr, monthName } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/ekonomi")({
  head: () => ({
    meta: [
      { title: "Ekonomi – Boendeplattformen" },
      {
        name: "description",
        content: "Se din avgift eller hyra, förfallodatum och betalningshistorik.",
      },
      { property: "og:title", content: "Ekonomi – Boendeplattformen" },
      { property: "og:description", content: "Avgift eller hyra och full betalningshistorik." },
    ],
  }),
  component: EconomyPage,
});

function EconomyPage() {
  const fn = useServerFn(getMyEconomy);
  const { data, isPending } = useQuery({ queryKey: ["my-economy"], queryFn: () => fn() });

  if (isPending || !data) return <LoadingBlock rows={4} />;

  const isRent = data.me.residency?.units?.tenure === "rented";
  const payments = data.payments;
  const next = payments.find((p) => p.status !== "paid") ?? payments[0];
  const unpaid = payments.filter((p) => p.status !== "paid");
  const paidThisYear = payments
    .filter(
      (p) => p.status === "paid" && new Date(p.period).getFullYear() === new Date().getFullYear(),
    )
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div>
      <PageHeader
        title="Ekonomi"
        subtitle={
          isRent ? "Din hyra och betalningshistorik" : "Din månadsavgift och betalningshistorik"
        }
      />

      <div className="mb-5 grid gap-5 sm:grid-cols-3">
        <Kpi
          label={isRent ? "Hyra per månad" : "Avgift per månad"}
          value={kr(next?.amount)}
          hint={next ? `Period ${monthName(next.period)}` : undefined}
        />
        <Kpi
          label="Obetalt"
          value={unpaid.length}
          tone={unpaid.length > 0 ? "warning" : "success"}
          hint={unpaid.length > 0 ? `Förfaller ${dateLong(unpaid[0]?.due_date)}` : "Allt är betalt"}
        />
        <Kpi label="Betalt i år" value={kr(paidThisYear)} />
      </div>

      {unpaid.length > 0 && (
        <Panel title="Att betala" description="Välj betalsätt – kort, Swish eller banköverföring.">
          <ul className="space-y-3">
            {unpaid.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
              >
                <div>
                  <p className="text-sm font-medium">{monthName(p.period)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.kind === "rent" ? "Hyra" : "Avgift"} · förfaller {dateLong(p.due_date)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tnum">{kr(p.amount)}</span>
                  <PaymentStatusBadge status={p.status} />
                  <PayDialog
                    payment={{
                      id: p.id,
                      amount: p.amount,
                      period: p.period,
                      due_date: p.due_date,
                    }}
                    kindLabel={p.kind === "rent" ? "Hyra" : "Avgift"}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="mt-5">
        <Panel title="Betalningshistorik">
          {payments.length === 0 ? (
            <EmptyState title="Inga betalningar registrerade" />
          ) : (
            <ul className="space-y-3">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
                >
                  <div>
                    <p className="text-sm font-medium">{monthName(p.period)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.kind === "rent" ? "Hyra" : "Avgift"} · förfaller {dateLong(p.due_date)}
                      {p.paid_at ? ` · betald ${dateLong(p.paid_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tnum">{kr(p.amount)}</span>
                    <PaymentStatusBadge status={p.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
