import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Wrench,
  CalendarCheck,
  Megaphone,
  Wallet,
  FolderOpen,
  Sparkles,
  Building2,
  Users,
  ShieldCheck,
  KeyRound,
  Check,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/app-shell";
import { StatusPill } from "@/components/status-badge";
import { SiteHeader } from "@/components/site-header";
import { AudienceArt, KeyScene, NeighborhoodScene, Skyline } from "@/components/illustrations";
import { getPublicStats, type PublicStats } from "@/lib/public.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Boendeplattformen – allt som rör ditt boende, på ett ställe" },
      {
        name: "description",
        content:
          "Mindre administration, färre mejltrådar och bättre koll för bostadsrättsföreningar och hyresvärdar. Felanmälan, bokningar, information och kommunikation med de boende i ett system.",
      },
      { property: "og:title", content: "Boendeplattformen – allt som rör ditt boende" },
      {
        property: "og:description",
        content:
          "Mindre administration. Färre mejltrådar. Bättre koll. Felanmälan, bokningar och kommunikation med de boende på ett ställe.",
      },
    ],
  }),
  loader: () => getPublicStats().catch((): PublicStats | null => null),
  staleTime: 5 * 60_000,
  component: Landing,
});

const nf = (digits: number) =>
  new Intl.NumberFormat("sv-SE", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/**
 * Nyckeltal ur demoföreningen (inte riktiga kunder). Visas bara om de gick
 * att räkna fram, och alltid märkta som exempeldata.
 */
function statRows(stats: PublicStats | null): [string, string][] {
  const rows: [string, string][] = [];
  if (stats?.units) rows.push([nf(0).format(stats.units), "lägenheter"]);
  if (stats?.avgResolutionDays != null)
    rows.push([`${nf(1).format(stats.avgResolutionDays)} dagar`, "i snitt till löst ärende"]);
  if (stats?.paidShare != null)
    rows.push([`${nf(1).format(stats.paidShare)} %`, "betalda avgifter senaste månaden"]);
  return rows;
}

const audiences = [
  {
    icon: Users,
    art: "resident" as const,
    title: "För boende",
    body: "Se din avgift eller hyra, gör felanmälan med bilder, boka tvättstuga och läs allt från föreningen på ett ställe.",
  },
  {
    icon: ShieldCheck,
    art: "board" as const,
    title: "För styrelsen",
    body: "Ärenden, medlemsregister, information, möten och dokument samlat – med full historik, så att inget försvinner när styrelsen byts ut.",
  },
  {
    icon: Building2,
    art: "owner" as const,
    title: "För fastighetsägaren",
    body: "Flera fastigheter, hundratals lägenheter, entreprenörer, underhållsplan och nyckeltal i samma vy.",
  },
];

/** Varje funktion beskrivs som problem, lösning och nytta för styrelsen. */
const features = [
  {
    icon: Wrench,
    title: "Felanmälan",
    problem: "Felanmälningar kommer via mejl, lappar och telefonsamtal till olika personer.",
    solution: "Alla felanmälningar samlas på ett ställe, med bilder, status och ansvarig.",
    benefit: "Styrelsen får överblick och kan följa varje ärende från anmälan till åtgärd.",
  },
  {
    icon: CalendarCheck,
    title: "Bokningar",
    problem: "Bokningslistor på papper försvinner, skrivs över eller leder till dubbelbokningar.",
    solution: "Tvättstuga, bastu, gästrum och lokaler bokas i appen enligt föreningens regler.",
    benefit: "Ingen i styrelsen behöver hålla ordning på listor eller reda ut krockar.",
  },
  {
    icon: Megaphone,
    title: "Kommunikation",
    problem: "Information på anslagstavlan och i mejl når inte alla boende.",
    solution:
      "Ett meddelande når alla, ett hus eller en lägenhet – i appen och via e-post eller sms.",
    benefit: "Ett utskick räcker, och styrelsen ser att informationen har gått ut.",
  },
  {
    icon: FolderOpen,
    title: "Dokument och information",
    problem: "Samma frågor om regler, tvättider och stadgar kommer till styrelsen gång på gång.",
    solution: "Stadgar, trivselregler, protokoll och nyheter finns samlade i appen.",
    benefit: "Boende hittar svaren själva, och styrelsen får färre enkla frågor.",
  },
  {
    icon: Wallet,
    title: "Ekonomi",
    problem: "Avgifter följs upp i kalkylark och bankutdrag som ingen annan hittar.",
    solution: "Avier med OCR-nummer, förfallodatum och betalstatus på ett ställe.",
    benefit: "Styrelsen ser direkt vad som är betalt och kan skicka påminnelser därifrån.",
  },
  {
    icon: Sparkles,
    title: "AI-assistent",
    problem: "Det är lätt att missa ärenden som blivit liggande eller möten som närmar sig.",
    solution: "Assistenten sammanställer varje dag det som behöver styrelsens uppmärksamhet.",
    benefit: "Styrelsen ser snabbt vad som behöver göras, utan att gå igenom allt själv.",
  },
];

/** Jämförelsen mellan hur det ofta ser ut idag och med plattformen. */
const before = [
  "Felanmälningar kommer via mejl, sms och samtal till olika personer",
  "Bokningslistor på papper som försvinner eller skrivs över",
  "Samma frågor om tvättider, avgifter och regler kommer om och om igen",
  "Information på anslagstavlan når inte alla",
  "Kunskapen försvinner när ledamöter lämnar styrelsen",
];

const after = [
  "Alla ärenden samlas i en lista med status och ansvarig",
  "Boende bokar själva, enligt föreningens regler",
  "Svaren finns i appen – boende hittar dem utan att kontakta styrelsen",
  "Meddelanden når rätt boende i appen, via e-post eller sms",
  "Historik och dokument finns kvar när styrelsen byts ut",
];

/** Kvarteret med svävande kort ur appen. */
function HeroVisual() {
  return (
    <div className="relative">
      <NeighborhoodScene className="drop-shadow-[0_24px_48px_oklch(0.3_0.08_256_/_0.18)]" />
      <div className="animate-float absolute top-[8%] -left-3 w-52 rounded-2xl border border-border bg-surface/95 p-3.5 shadow-[var(--shadow-lift)] backdrop-blur sm:-left-8">
        <p className="text-xs text-muted-foreground">Min avgift · September</p>
        <p className="mt-0.5 text-lg font-semibold tnum">5 420 kr</p>
        <div className="mt-2">
          <StatusPill tone="success">Betald</StatusPill>
        </div>
      </div>
      <div
        className="animate-float absolute -right-3 bottom-[30%] w-56 rounded-2xl border border-border bg-surface/95 p-3.5 shadow-[var(--shadow-lift)] backdrop-blur sm:-right-6"
        style={{ animationDelay: "1.5s" }}
      >
        <p className="text-xs text-muted-foreground">Min felanmälan</p>
        <p className="mt-0.5 text-sm font-medium">Element i sovrum</p>
        <div className="mt-2 flex items-center gap-2">
          <StatusPill tone="warning">Pågående</StatusPill>
          <span className="text-xs text-muted-foreground">idag 14:32</span>
        </div>
      </div>
      <div
        className="animate-float absolute bottom-[4%] left-[12%] flex items-center gap-3 rounded-2xl border border-border bg-surface/95 px-3.5 py-3 shadow-[var(--shadow-lift)] backdrop-blur"
        style={{ animationDelay: "3s" }}
      >
        <span className="grid size-9 place-items-center rounded-xl bg-success-soft text-success">
          <KeyRound className="size-4" />
        </span>
        <span>
          <span className="block text-sm font-medium">Porten är upplåst</span>
          <span className="block text-xs text-muted-foreground">Storgatan 12 · NFC</span>
        </span>
      </div>
    </div>
  );
}

function Landing() {
  const stats = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_80%_20%,var(--primary-soft),transparent_70%),radial-gradient(40%_40%_at_10%_90%,var(--glow-soft),transparent_70%)] opacity-80"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pt-16 pb-20 sm:pt-24 lg:grid-cols-[1.05fr_1fr]">
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
            <p className="mt-6 text-xl font-medium sm:text-2xl">
              Mindre administration. Färre mejltrådar. Bättre koll.
            </p>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              Felanmälningar, bokningar, information och kommunikation med de boende samlas i ett
              system. Styrelsen får överblick, och de boende hittar svaren själva i stället för att
              höra av sig om enkla frågor.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/boka-demo">Boka en demo</Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <a href="#sa-fungerar-det">Se hur det fungerar</a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Eller{" "}
              <Link
                to="/auth"
                hash="demo"
                className="font-medium text-foreground underline underline-offset-4"
              >
                prova demomiljön direkt
              </Link>{" "}
              – ingen registrering behövs.
            </p>
            {statRows(stats).length > 0 ? (
              <figure className="mt-12 max-w-lg border-t border-border pt-5">
                <figcaption className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border bg-surface px-2 py-0.5 font-medium">
                    Exempeldata
                  </span>
                  Så kan översikten se ut i din förening
                </figcaption>
                <dl className="mt-4 grid grid-cols-3 gap-6">
                  {statRows(stats).map(([value, label]) => (
                    <div key={label}>
                      <dt className="text-lg font-semibold whitespace-nowrap tnum sm:text-xl">
                        {value}
                      </dt>
                      <dd className="mt-1 text-xs text-muted-foreground">{label}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-muted-foreground/80">
                  Siffrorna kommer från vår demoförening, inte från riktiga kunder.
                </p>
              </figure>
            ) : null}
          </div>
          <HeroVisual />
        </div>
      </section>

      <section id="sa-fungerar-det" className="scroll-mt-28 mx-auto max-w-6xl px-5 pb-20">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Från mejltrådar och lappar till ett gemensamt system
          </h2>
          <p className="mt-4 text-muted-foreground">
            I många föreningar ligger felanmälningarna i någons inkorg, bokningslistan hänger i
            tvättstugan och informationen finns i ett gammalt nyhetsbrev. Boendeplattformen samlar
            allt, så att både styrelse och boende vet var de ska leta.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="card-surface p-6">
            <h3 className="text-base font-semibold text-muted-foreground">
              Så ser det ofta ut idag
            </h3>
            <ul className="mt-4 space-y-3 text-sm">
              {before.map((t) => (
                <li key={t} className="flex items-start gap-3 text-muted-foreground">
                  <X className="mt-0.5 size-4 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="card-surface p-6">
            <h3 className="text-base font-semibold">Med Boendeplattformen</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {after.map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ett system, tre perspektiv
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {audiences.map((a) => (
              <div key={a.title} className="card-surface overflow-hidden">
                <AudienceArt kind={a.art} className="rounded-none" />
                <div className="p-6">
                  <h3 className="flex items-center gap-2 text-base font-semibold">
                    <a.icon className="size-4 text-primary" />
                    {a.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Det här får föreningen
        </h2>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Varje del av plattformen tar bort ett konkret moment i styrelsearbetet – så att mindre tid
          går till administration och mer till föreningen.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card-surface p-6">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <f.icon className="size-5 text-primary" />
                {f.title}
              </h3>
              <dl className="mt-4 space-y-3 text-sm leading-relaxed">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Problem</dt>
                  <dd className="mt-0.5 text-muted-foreground">{f.problem}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-primary">Lösning</dt>
                  <dd className="mt-0.5">{f.solution}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-success">Nytta</dt>
                  <dd className="mt-0.5 font-medium">{f.benefit}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 lg:grid-cols-2 lg:items-center">
        <KeyScene className="order-last lg:order-first" />
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-glow/40 bg-glow-soft px-3 py-1 text-xs text-foreground">
            <KeyRound className="size-3.5" /> Nyhet: digitala nycklar
          </span>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
            Mobilen är nyckeln
          </h2>
          <p className="mt-4 max-w-lg text-muted-foreground">
            Håll telefonen mot läsaren vid porten, tvättstugan eller garaget – dörren öppnas om du
            har behörighet. Boende får tillgång till sin fastighet automatiskt, och hantverkare och
            hemtjänst får tidsbegränsade nycklar som slutar gälla av sig själva.
          </p>
          <ul className="mt-6 space-y-2 text-sm">
            {[
              "Inga borttappade brickor att spärra",
              "Varje passage loggas – se vem som öppnat och när",
              "Återkalla en nyckel direkt, från var som helst",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-glow" />
                {t}
              </li>
            ))}
          </ul>
          <Button className="mt-8" variant="outline" asChild>
            <Link to="/priser">Se priser och tillägg</Link>
          </Button>
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
              Assistenten sammanställer läget i fastigheten varje dag, så att styrelsen snabbt ser
              vad som behöver göras: ärenden som väntat för länge, obetalda avgifter, projekt utan
              uppdatering och möten som närmar sig. Byggd så att mer AI-stöd kan kopplas in –
              sammanfattningar, utkast till information och analys av återkommande problem.
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

      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-5 pt-24 pb-10 text-center">
          <h2 className="font-display text-4xl leading-tight sm:text-5xl">
            Mindre tid på administration. Mer tid för föreningen.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            Boka en demo så går vi igenom hur plattformen fungerar för just er förening eller ert
            fastighetsbolag – och hur ni kommer igång på en eftermiddag.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/boka-demo">Boka en demo</Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link to="/auth" hash="demo">
                Prova demomiljön
              </Link>
            </Button>
          </div>
        </div>
        <Skyline />
      </section>

      <footer className="bg-navy py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 text-sm text-muted-foreground">
          <Logo inverted />
          <p className="text-white/70">Allt som rör ditt boende – på ett ställe.</p>
        </div>
      </footer>
    </div>
  );
}
