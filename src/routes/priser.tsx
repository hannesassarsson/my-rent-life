import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { StatusPill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PLANS,
  PLAN_IDS,
  TRIAL_DAYS,
  VAT_RATE,
  billableUnits,
  kronor,
  priceFor,
  type BillingInterval,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/priser")({
  head: () => ({
    meta: [
      { title: "Priser – Boendeplattformen" },
      {
        name: "description",
        content:
          "Enkla priser per lägenhet för bostadsrättsföreningar, hyresvärdar och förvaltare. Inga startavgifter, 30 dagar gratis.",
      },
      { property: "og:title", content: "Priser – Boendeplattformen" },
    ],
  }),
  component: PricingPage,
});

const FAQ = [
  {
    q: "Vad räknas som en lägenhet?",
    a: "Varje bostad som finns i systemet. Lokaler, förråd och parkeringar räknas inte. Antalet uppdateras automatiskt när ni lägger till eller tar bort lägenheter.",
  },
  {
    q: "Kostar det något för de boende?",
    a: "Nej. Föreningen eller hyresvärden betalar abonnemanget, och alla boende använder appen utan kostnad.",
  },
  {
    q: "Hur fungerar provperioden?",
    a: `Ni får ${TRIAL_DAYS} dagar med hela Standard utan kostnad och utan kort. Väljer ni en plan under provperioden dras första betalningen först när den är slut.`,
  },
  {
    q: "Kan vi betala mot faktura?",
    a: "Ja. Kort fungerar direkt i appen. För faktura med bankgiro, till exempel via er ekonomiska förvaltare, hör ni av er till oss.",
  },
  {
    q: "Kan vi byta plan eller säga upp?",
    a: "Ja, när som helst. Byter ni plan justeras priset direkt. Säger ni upp gäller abonnemanget perioden ut, och ni kan exportera er data.",
  },
];

function PricingPage() {
  const [units, setUnits] = useState(60);
  const [interval, setInterval] = useState<BillingInterval>("year");
  const safeUnits = Number.isFinite(units) && units > 0 ? Math.min(units, 100_000) : 1;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-5 pt-16 pb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Enkla priser per lägenhet
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Inga startavgifter och inga bindningstider. Prova gratis i {TRIAL_DAYS} dagar, de boende
          använder alltid appen utan kostnad.
        </p>

        <div className="mx-auto mt-10 flex max-w-xl flex-wrap items-end justify-center gap-4">
          <div className="space-y-2 text-left">
            <Label htmlFor="units">Antal lägenheter</Label>
            <Input
              id="units"
              type="number"
              min={1}
              max={100000}
              value={units}
              onChange={(e) => setUnits(Number(e.target.value))}
              className="w-36"
            />
          </div>
          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm">
            {(
              [
                ["month", "Månadsvis"],
                ["year", "Årsvis – 2 mån gratis"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setInterval(v)}
                className={cn(
                  "rounded-md px-3 py-2 transition-colors",
                  interval === v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-5 md:grid-cols-3">
        {PLAN_IDS.map((id) => {
          const plan = PLANS[id];
          const price = priceFor(id, safeUnits, interval);
          const minApplies = billableUnits(id, safeUnits) > safeUnits;
          return (
            <div
              key={id}
              className={cn(
                "card-surface flex flex-col p-6",
                id === "standard" && "ring-2 ring-primary",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                {id === "standard" ? <StatusPill tone="info">Vanligast</StatusPill> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
              <p className="mt-5">
                <span className="text-3xl font-semibold tnum">{plan.perUnit} kr</span>
                <span className="text-sm text-muted-foreground"> / lägenhet och månad</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Lägsta pris {kronor(plan.minMonthly)} per månad
              </p>
              <div className="mt-4 rounded-xl bg-surface-muted p-3 text-sm">
                <p>
                  <span className="font-semibold tnum">{kronor(price)}</span>{" "}
                  <span className="text-muted-foreground">
                    per {interval === "year" ? "år" : "månad"} för {safeUnits} lägenheter
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {kronor(price * (1 + VAT_RATE))} inkl. moms
                  {minApplies ? " · lägsta pris" : ""}
                </p>
              </div>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    {h}
                  </li>
                ))}
              </ul>
              <Button className="mt-6" variant={id === "standard" ? "default" : "outline"} asChild>
                <Link to="/boka-demo">Kom igång</Link>
              </Button>
            </div>
          );
        })}
      </section>

      <p className="mx-auto mt-6 max-w-6xl px-5 text-center text-sm text-muted-foreground">
        Alla priser är exklusive 25 % moms. Fler än 2 000 lägenheter?{" "}
        <Link to="/boka-demo" className="underline underline-offset-4">
          Kontakta oss
        </Link>{" "}
        för ett eget pris.
      </p>

      <section className="mx-auto max-w-3xl px-5 py-20">
        <h2 className="text-2xl font-semibold tracking-tight">Vanliga frågor</h2>
        <dl className="mt-6 divide-y divide-border">
          {FAQ.map((f) => (
            <div key={f.q} className="py-5">
              <dt className="font-medium">{f.q}</dt>
              <dd className="mt-2 text-sm text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
