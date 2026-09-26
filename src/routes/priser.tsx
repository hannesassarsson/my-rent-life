import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TRIAL_DAYS } from "@/lib/plans";
import { PlanPicker, type PlanChoice } from "@/components/plan-picker";

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
  const [choice, setChoice] = useState<PlanChoice>({
    plan: "standard",
    addons: [],
    interval: "year",
  });
  const safeUnits = Number.isFinite(units) && units > 0 ? Math.min(Math.round(units), 100_000) : 1;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-5 pt-16 pb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Betala för det ni använder
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Välj en grund och lägg till de delar ni behöver – priset räknas per lägenhet. Inga
          startavgifter och inga bindningstider. Prova gratis i {TRIAL_DAYS} dagar; de boende
          använder alltid appen utan kostnad.
        </p>
        <div className="mx-auto mt-8 flex max-w-xs flex-col items-center gap-2">
          <Label htmlFor="units">Antal lägenheter</Label>
          <Input
            id="units"
            type="number"
            min={1}
            max={100000}
            value={units}
            onChange={(e) => setUnits(Number(e.target.value))}
            className="w-36 text-center"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5">
        <PlanPicker
          units={safeUnits}
          value={choice}
          onChange={setChoice}
          action={
            <Button asChild>
              <Link to="/boka-demo">Kom igång – 30 dagar gratis</Link>
            </Button>
          }
        />
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
