import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import {
  confirmCheckout,
  getBilling,
  openBillingPortal,
  startCheckout,
} from "@/lib/billing.functions";
import {
  PLANS,
  PLAN_IDS,
  VAT_RATE,
  billableUnits,
  kronor,
  priceFor,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans";
import { DataRow, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { dateLong } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/abonnemang")({
  validateSearch: z.object({ kop: z.string().optional() }),
  head: () => ({ meta: [{ title: "Abonnemang – Boendeplattformen" }] }),
  component: BillingPage,
});

type Billing = Awaited<ReturnType<typeof getBilling>>;

function statusText(sub: NonNullable<Billing["subscription"]>) {
  if (sub.isDemo) return { label: "Demo", tone: "info" as const };
  if (sub.invoiceBilling) return { label: "Faktura", tone: "success" as const };
  switch (sub.status) {
    case "trialing":
      return sub.hasStripeSubscription
        ? {
            label: `Provperiod, betalning startar ${dateLong(sub.trialEndsAt)}`,
            tone: "info" as const,
          }
        : { label: `Provperiod till ${dateLong(sub.trialEndsAt)}`, tone: "info" as const };
    case "active":
      return sub.cancelAtPeriodEnd
        ? {
            label: `Uppsagt, gäller till ${dateLong(sub.currentPeriodEnd)}`,
            tone: "warning" as const,
          }
        : { label: "Aktivt", tone: "success" as const };
    case "past_due":
      return { label: "Betalningen misslyckades", tone: "danger" as const };
    default:
      return { label: "Avslutat", tone: "neutral" as const };
  }
}

function BillingPage() {
  const fn = useServerFn(getBilling);
  const checkoutFn = useServerFn(startCheckout);
  const confirmFn = useServerFn(confirmCheckout);
  const portalFn = useServerFn(openBillingPortal);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { kop } = Route.useSearch();
  const { data, isPending } = useQuery({ queryKey: ["billing"], queryFn: () => fn() });
  const [interval, setInterval] = useState<BillingInterval>("year");
  const confirmed = useRef(false);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["billing"] });
    void qc.invalidateQueries({ queryKey: ["me"] });
  };

  // Tillbaka från Stripe Checkout: hämta abonnemanget direkt i stället för
  // att vänta på Stripes webhook.
  useEffect(() => {
    if (!kop || confirmed.current) return;
    confirmed.current = true;
    confirmFn({ data: { sessionId: kop } })
      .then((r) => {
        if (r.ok) toast.success("Tack! Abonnemanget är aktiverat.");
        refresh();
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => void navigate({ to: "/admin/abonnemang", search: {}, replace: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kop]);

  useEffect(() => {
    const current = data?.subscription?.billingInterval;
    if (current === "month" || current === "year") setInterval(current);
  }, [data?.subscription?.billingInterval]);

  const checkout = useMutation({
    mutationFn: (plan: PlanId) => checkoutFn({ data: { plan, interval } }),
    onSuccess: (r) => {
      if (r.url) {
        window.location.assign(r.url);
        return;
      }
      toast.success("Planen är ändrad");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const portal = useMutation({
    mutationFn: () => portalFn(),
    onSuccess: (r) => window.location.assign(r.url),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || !data) return <LoadingBlock rows={4} />;

  const sub = data.subscription;
  const status = sub ? statusText(sub) : null;
  const isDemo = !!sub?.isDemo;
  const currentPlan = sub?.hasStripeSubscription ? sub.plan : null;
  const busy = checkout.isPending || portal.isPending || !!kop;
  const canBuy = data.configured && !isDemo;

  return (
    <div>
      <PageHeader
        title="Abonnemang"
        subtitle="Plan, betalning och kvitton för er organisation"
        action={
          data.configured && data.testMode ? (
            <StatusPill tone="warning">Testläge – inga riktiga pengar dras</StatusPill>
          ) : null
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Nuvarande abonnemang" className="lg:col-span-2">
          <dl>
            <DataRow label="Plan" value={sub ? PLANS[sub.plan].name : "–"} />
            <DataRow
              label="Status"
              value={status ? <StatusPill tone={status.tone}>{status.label}</StatusPill> : "–"}
            />
            <DataRow label="Lägenheter" value={data.units} />
            {sub?.currentPeriodEnd && sub.status !== "trialing" ? (
              <DataRow
                label={sub.cancelAtPeriodEnd ? "Gäller till" : "Nästa betalning"}
                value={dateLong(sub.currentPeriodEnd)}
              />
            ) : null}
          </dl>
          {sub?.hasStripeCustomer ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="outline" disabled={busy} onClick={() => portal.mutate()}>
                {portal.isPending ? "Öppnar…" : "Betalningsuppgifter och kvitton"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Byt kort, ladda ner kvitton, ändra fakturaadress eller säg upp.
              </p>
            </div>
          ) : null}
        </Panel>

        <Panel title="Så räknas priset">
          <p className="text-sm text-muted-foreground">
            Priset är per lägenhet och månad, med ett lägsta pris per plan. Antalet lägenheter
            uppdateras automatiskt när ni lägger till eller tar bort lägenheter.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Vid årsbetalning betalar ni för tio månader av tolv. Alla priser är exklusive 25 % moms.
          </p>
        </Panel>
      </div>

      {isDemo ? (
        <p className="mt-6 rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
          Demoföreningen har alla funktioner. Här ser du hur planerna och priserna visas för en
          riktig förening; köp är avstängda i demon.
        </p>
      ) : null}
      {!data.configured ? (
        <p className="mt-6 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning-foreground">
          Betalningen är inte konfigurerad ännu.
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Planer</h2>
        <IntervalToggle value={interval} onChange={setInterval} />
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-3">
        {PLAN_IDS.map((id) => {
          const plan = PLANS[id];
          const price = priceFor(id, data.units, interval);
          const isCurrent =
            currentPlan === id && sub?.billingInterval === interval && sub.status !== "canceled";
          const minApplies = billableUnits(id, data.units) > data.units;
          return (
            <section
              key={id}
              className={cn(
                "card-surface flex flex-col p-5",
                id === "standard" && "ring-2 ring-primary",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">{plan.name}</h3>
                {id === "standard" ? <StatusPill tone="info">Vanligast</StatusPill> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{plan.tagline}</p>
              <p className="mt-4">
                <span className="text-2xl font-semibold tnum">{kronor(price)}</span>
                <span className="text-sm text-muted-foreground">
                  {" "}
                  / {interval === "year" ? "år" : "månad"}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {kronor(price * (1 + VAT_RATE))} inkl. moms ·{" "}
                {minApplies
                  ? `lägsta pris ${kronor(plan.minMonthly)}/mån`
                  : `${plan.perUnit} kr × ${data.units} lägenheter`}
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    {h}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-5"
                variant={id === "standard" ? "default" : "outline"}
                disabled={!canBuy || isCurrent || busy}
                onClick={() => checkout.mutate(id)}
              >
                {isCurrent
                  ? "Nuvarande plan"
                  : checkout.isPending && checkout.variables === id
                    ? "Öppnar…"
                    : currentPlan
                      ? `Byt till ${plan.name}`
                      : `Välj ${plan.name}`}
              </Button>
            </section>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Vill ni hellre betala mot faktura med bankgiro, eller har ni fler än 2 000 lägenheter? Hör
        av er till oss så ordnar vi det.
      </p>
    </div>
  );
}

function IntervalToggle({
  value,
  onChange,
}: {
  value: BillingInterval;
  onChange: (v: BillingInterval) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm">
      {(
        [
          ["month", "Månadsvis"],
          ["year", "Årsvis – 2 månader gratis"],
        ] as const
      ).map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "rounded-md px-3 py-1.5 transition-colors",
            value === v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
