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
  refreshBilling,
  startCheckout,
} from "@/lib/billing.functions";
import { ADDONS, ADDON_IDS, PLANS, extraAddons, type AddonId } from "@/lib/plans";
import { PlanPicker, type PlanChoice } from "@/components/plan-picker";
import { DataRow, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { dateLong } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/abonnemang")({
  validateSearch: z.object({ kop: z.string().optional(), synk: z.coerce.number().optional() }),
  head: () => ({ meta: [{ title: "Abonnemang – Boendeplattformen" }] }),
  component: BillingPage,
});

type Billing = Awaited<ReturnType<typeof getBilling>>;

function statusText(sub: NonNullable<Billing["subscription"]>) {
  if (sub.isDemo) return { label: "Demo", tone: "info" as const };
  if (sub.invoiceBilling) return { label: "Faktura", tone: "success" as const };
  if (sub.cancelAtPeriodEnd && ["trialing", "active", "past_due"].includes(sub.status)) {
    const end = sub.status === "trialing" ? sub.trialEndsAt : sub.currentPeriodEnd;
    return { label: `Uppsagt, gäller till ${dateLong(end)}`, tone: "warning" as const };
  }
  switch (sub.status) {
    case "trialing":
      return sub.hasStripeSubscription
        ? {
            label: `Provperiod, betalning startar ${dateLong(sub.trialEndsAt)}`,
            tone: "info" as const,
          }
        : { label: `Provperiod till ${dateLong(sub.trialEndsAt)}`, tone: "info" as const };
    case "active":
      return { label: "Aktivt", tone: "success" as const };
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
  const refreshFn = useServerFn(refreshBilling);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { kop, synk } = Route.useSearch();
  const { data, isPending } = useQuery({ queryKey: ["billing"], queryFn: () => fn() });
  const [choice, setChoice] = useState<PlanChoice>({
    plan: "standard",
    addons: [],
    interval: "year",
  });
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

  // Tillbaka från kundportalen: läs in eventuella ändringar direkt.
  useEffect(() => {
    if (!synk) return;
    refreshFn()
      .then(refresh)
      .catch((e: Error) => toast.error(e.message))
      .finally(() => void navigate({ to: "/admin/abonnemang", search: {}, replace: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synk]);

  // Utgå från det nuvarande abonnemanget när sidan laddas.
  const loadedSub = data?.subscription;
  useEffect(() => {
    if (!loadedSub) return;
    setChoice({
      plan: loadedSub.plan,
      addons: loadedSub.addons.filter((a): a is AddonId =>
        (ADDON_IDS as readonly string[]).includes(a),
      ),
      interval: loadedSub.billingInterval === "month" ? "month" : "year",
    });
  }, [loadedSub]);

  const checkout = useMutation({
    mutationFn: (c: PlanChoice) => checkoutFn({ data: c }),
    onSuccess: (r) => {
      if (r.url) {
        window.location.assign(r.url);
        return;
      }
      toast.success("Abonnemanget är uppdaterat");
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
  const currentExtras = sub ? extraAddons(sub.plan, sub.addons) : [];
  const chosenExtras = extraAddons(choice.plan, choice.addons);
  const unchanged =
    !!currentPlan &&
    sub?.status !== "canceled" &&
    !sub?.cancelAtPeriodEnd &&
    currentPlan === choice.plan &&
    sub?.billingInterval === choice.interval &&
    currentExtras.length === chosenExtras.length &&
    currentExtras.every((a) => chosenExtras.includes(a));
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
            {currentExtras.length > 0 ? (
              <DataRow
                label="Tillägg"
                value={currentExtras.map((a) => ADDONS[a].name).join(", ")}
              />
            ) : null}
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

      <div className="mt-8">
        <PlanPicker
          units={data.units}
          value={choice}
          onChange={setChoice}
          currentPlan={currentPlan}
          action={
            <Button
              className="w-full sm:w-auto"
              disabled={!canBuy || unchanged || busy}
              onClick={() => checkout.mutate(choice)}
            >
              {unchanged
                ? "Det här är ert nuvarande abonnemang"
                : checkout.isPending
                  ? "Öppnar…"
                  : currentPlan
                    ? "Uppdatera abonnemanget"
                    : "Gå till betalning"}
            </Button>
          }
        />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Vill ni hellre betala mot faktura med bankgiro, eller har ni fler än 2 000 lägenheter? Hör
        av er till oss så ordnar vi det.
      </p>
    </div>
  );
}
