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
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/app-shell";
import { StatusPill } from "@/components/status-badge";
import { SiteHeader } from "@/components/site-header";
import { AudienceArt, KeyScene, Skyline } from "@/components/illustrations";
import { HeroAnimation } from "@/components/hero-animation";

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
  component: Landing,
});

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

/** Hur det ofta ser ut idag – i samma ordning som funktionerna nedan. */
const before = [
  "Felanmälningar kommer via mejl, sms och samtal till olika personer",
  "Bokningslistor på papper som försvinner eller skrivs över",
  "Information på anslagstavlan når inte alla",
  "Samma frågor kommer om och om igen, och kunskapen försvinner när styrelsen byts ut",
  "Avgifter följs upp i kalkylark som bara en person hittar",
];

/** Vad plattformen gör åt vart och ett av problemen ovan. */
const features = [
  {
    icon: Wrench,
    title: "Felanmälan",
    body: "Alla ärenden på ett ställe, med bilder, status och ansvarig.",
  },
  {
    icon: CalendarCheck,
    title: "Bokningar",
    body: "Tvättstuga, bastu och lokaler bokas i appen enligt föreningens regler.",
  },
  {
    icon: Megaphone,
    title: "Kommunikation",
    body: "Nå alla, ett hus eller en lägenhet – i appen, via e-post eller sms.",
  },
  {
    icon: FolderOpen,
    title: "Dokument och historik",
    body: "Stadgar, regler och protokoll samlade, och kvar när styrelsen byts ut.",
  },
  {
    icon: Wallet,
    title: "Ekonomi",
    body: "Avier med OCR-nummer, betalstatus och påminnelser på ett ställe.",
  },
];

function Landing() {
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
            <h1 className="font-display text-5xl leading-[1.05] sm:text-6xl">
              Allt som rör ditt boende.
              <br />
              På ett ställe.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
              Felanmälan, bokningar, information och kommunikation för bostadsrättsföreningar och
              hyresvärdar – samlat i ett system. Mindre administration, bättre koll.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
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
          <HeroAnimation className="mx-auto lg:mr-0" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
          Från mejltrådar och lappar till ett gemensamt system
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="card-surface p-6">
            <h3 className="text-base font-semibold text-muted-foreground">
              Så ser det ofta ut idag
            </h3>
            <ul className="mt-5 space-y-4 text-sm">
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
            <ul className="mt-5 space-y-4 text-sm">
              {features.map((f) => (
                <li key={f.title} className="flex items-start gap-3">
                  <f.icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    <span className="font-medium">{f.title}.</span> {f.body}
                  </span>
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

      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-2 lg:items-center">
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
