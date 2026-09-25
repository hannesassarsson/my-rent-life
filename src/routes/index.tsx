import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Wrench,
  CalendarCheck,
  Megaphone,
  Wallet,
  FolderOpen,
  BarChart3,
  Sparkles,
  Building2,
  Users,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/app-shell";
import { StatusPill } from "@/components/status-badge";
import { getPublicStats, type PublicStats } from "@/lib/public.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Boendeplattformen – allt som rör ditt boende, på ett ställe" },
      {
        name: "description",
        content:
          "En modern boendeplattform för bostadsrättsföreningar, fastighetsägare och hyresgäster. Felanmälan, bokningar, ekonomi, dokument och kommunikation i ett system.",
      },
      { property: "og:title", content: "Boendeplattformen – allt som rör ditt boende" },
      {
        property: "og:description",
        content:
          "Felanmälan, bokningar, ekonomi, dokument, möten och kommunikation för föreningar, fastighetsägare och boende.",
      },
    ],
  }),
  loader: () => getPublicStats().catch((): PublicStats | null => null),
  staleTime: 5 * 60_000,
  component: Landing,
});

const nf = (digits: number) =>
  new Intl.NumberFormat("sv-SE", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Nyckeltalen visas bara om de gick att räkna fram. */
function statRows(stats: PublicStats | null): [string, string][] {
  const rows: [string, string][] = [];
  if (stats?.units) rows.push([nf(0).format(stats.units), "lägenheter i demo"]);
  if (stats?.avgResolutionDays != null)
    rows.push([`${nf(1).format(stats.avgResolutionDays)} dagar`, "snitt till löst ärende"]);
  if (stats?.paidShare != null)
    rows.push([`${nf(1).format(stats.paidShare)} %`, "betalda avgifter senaste månaden"]);
  return rows;
}

const audiences = [
  {
    icon: Users,
    title: "För boende",
    body: "Se din avgift eller hyra, gör felanmälan med bilder, boka tvättstuga och läs allt från föreningen på ett ställe.",
  },
  {
    icon: ShieldCheck,
    title: "För styrelsen",
    body: "Ärenden, medlemsregister, information, möten och dokument samlat – med full historik och tydligt ansvar.",
  },
  {
    icon: Building2,
    title: "För fastighetsägaren",
    body: "Flera fastigheter, hundratals lägenheter, entreprenörer, underhållsplan och nyckeltal i samma vy.",
  },
];

const features = [
  {
    icon: Wrench,
    title: "Felanmälan",
    body: "Guidat flöde, kategorier, bilder och akutmarkering. Tidslinje och kommentarer hela vägen till löst ärende.",
  },
  {
    icon: CalendarCheck,
    title: "Bokningar",
    body: "Tvättstuga, bastu, gästrum, festlokal, hobbyrum och laddplatser med regler som ni själva sätter.",
  },
  {
    icon: Megaphone,
    title: "Kommunikation",
    body: "Driftinformation och nyheter riktade till alla, en fastighet, ett hus eller enskilda lägenheter.",
  },
  {
    icon: Wallet,
    title: "Ekonomi",
    body: "Avgift eller hyra, förfallodatum och betalningshistorik. Förberett för betalningsintegrationer.",
  },
  {
    icon: FolderOpen,
    title: "Dokument",
    body: "Stadgar, avtal, planritningar och protokoll – rätt dokument till rätt boende.",
  },
  {
    icon: BarChart3,
    title: "Statistik",
    body: "Lösningstider, vanligaste felkategorier, beläggning och betalningsgrad i tydliga nyckeltal.",
  },
];

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Logo />
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link to="/auth">Logga in</Link>
          </Button>
          <Button asChild>
            <Link to="/boka-demo">Boka demo</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function DashboardMockup() {
  return (
    <div className="card-surface w-full overflow-hidden shadow-[var(--shadow-lift)]">
      <div className="flex items-center gap-2 border-b border-border bg-surface-muted px-4 py-3">
        <span className="size-2.5 rounded-full bg-danger/40" />
        <span className="size-2.5 rounded-full bg-warning/50" />
        <span className="size-2.5 rounded-full bg-success/40" />
        <span className="ml-3 text-xs text-muted-foreground">Översikt · BRF Solrosen</span>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Min avgift · September</p>
          <p className="mt-1 text-2xl font-semibold tnum">5 420 kr</p>
          <p className="mt-1 text-xs text-muted-foreground">Förfaller 30 september</p>
          <div className="mt-3">
            <StatusPill tone="success">Betald</StatusPill>
          </div>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Min felanmälan</p>
          <p className="mt-1 text-sm font-medium">Element i sovrum</p>
          <p className="mt-1 text-xs text-muted-foreground">Senast uppdaterad idag 14:32</p>
          <div className="mt-3">
            <StatusPill tone="warning">Pågående</StatusPill>
          </div>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Nästa bokning</p>
          <p className="mt-1 text-sm font-medium">🧺 Tvättstuga 1</p>
          <p className="mt-1 text-xs text-muted-foreground">Idag 18:00–20:00</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Viktig information</p>
          <p className="mt-1 text-sm font-medium">📢 Vattenavstängning torsdag</p>
          <p className="mt-1 text-xs text-muted-foreground">Storgatan 12, kl. 08–14</p>
        </div>
      </div>
    </div>
  );
}

function Landing() {
  const stats = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="mx-auto max-w-6xl px-5 pt-16 pb-20 sm:pt-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="size-3.5" />
              För bostadsrättsföreningar, hyresvärdar och förvaltare
            </span>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] sm:text-6xl">
              Allt som rör ditt boende.
              <br />
              På ett ställe.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              En modern boendeplattform för bostadsrättsföreningar, fastighetsägare och hyresgäster.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/boka-demo">Boka demo</Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link to="/auth" hash="demo">
                  Se demomiljön
                </Link>
              </Button>
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6">
              {statRows(stats).map(([value, label]) => (
                <div key={label}>
                  <dt className="text-xl font-semibold tnum">{value}</dt>
                  <dd className="mt-1 text-xs text-muted-foreground">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
          <DashboardMockup />
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ett system, tre perspektiv
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {audiences.map((a) => (
              <div key={a.title} className="card-surface p-6">
                <a.icon className="size-5 text-primary" />
                <h3 className="mt-4 text-base font-semibold">{a.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Allt förvaltningen behöver – utan gammal känsla
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card-surface p-6">
              <f.icon className="size-5 text-primary" />
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="size-3.5" /> AI-assistent
            </span>
            <h2 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
              ”Vad behöver jag veta idag?”
            </h2>
            <p className="mt-4 max-w-lg text-muted-foreground">
              Plattformen sammanställer läget i fastigheten varje dag: ärenden som väntat för länge,
              obetalda avgifter, projekt utan uppdatering och möten som närmar sig. Byggd så att mer
              AI-stöd kan kopplas in – sammanfattningar, utkast till information och analys av
              återkommande problem.
            </p>
          </div>
          <div className="card-surface p-6">
            <p className="text-sm font-medium">5 saker behöver uppmärksamhet</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <StatusPill tone="danger">Akut</StatusPill>
                <span>2 felanmälningar har väntat längre än 7 dagar.</span>
              </li>
              <li className="flex items-start gap-3">
                <StatusPill tone="warning">Ekonomi</StatusPill>
                <span>3 avgifter är obetalda denna period.</span>
              </li>
              <li className="flex items-start gap-3">
                <StatusPill tone="warning">Projekt</StatusPill>
                <span>Fasadprojektet saknar uppdatering.</span>
              </li>
              <li className="flex items-start gap-3">
                <StatusPill tone="info">Möte</StatusPill>
                <span>Föreningsstämman är om 14 dagar.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24 text-center">
        <h2 className="font-display text-4xl leading-tight sm:text-5xl">
          Min digitala plats för allt som rör mitt boende.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
          Boka en demo och se hur föreningen eller fastighetsbolaget kommer igång på en eftermiddag.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/boka-demo">Boka demo</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 text-sm text-muted-foreground">
          <Logo />
          <p>Allt som rör ditt boende – på ett ställe.</p>
        </div>
      </footer>
    </div>
  );
}
