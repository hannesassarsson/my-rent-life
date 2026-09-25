# Boendeplattformen

Demo av en plattform för hyresvärdar, fastighetsägare och bostadsrättsföreningar –
och deras boende. Felanmälan, bokningar, ekonomi, dokument, möten och kommunikation
i samma system.

- **Boendevy** (`/app`): avgift/hyra, felanmälningar, bokning av tvättstuga m.m.,
  information, dokument och meddelanden.
- **Adminvy** (`/admin`): översikt, ärenden, fastigheter, boende, entreprenörer,
  kommunikation, bokningsinställningar, ekonomi och underhållsplan.

## Teknik

- [TanStack Start](https://tanstack.com/start) (React 19, TanStack Router/Query) på Vite
- Tailwind CSS 4 och shadcn/ui
- [Supabase](https://supabase.com) för auth och Postgres (Row Level Security)
- [Nitro](https://nitro.build) bygger servern för driftsättning
- Zod för validering av serverfunktioners indata

## Kom igång

Kräver [Bun](https://bun.sh) (eller Node 22 + npm).

```sh
bun install
bun run dev        # http://localhost:8080
```

### Miljövariabler

Lägg dem i `.env` (se befintlig fil):

| Variabel                        | Används av                                    |
| ------------------------------- | --------------------------------------------- |
| `VITE_SUPABASE_URL`             | Klienten (webbläsaren)                        |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Klienten (webbläsaren)                        |
| `SUPABASE_URL`                  | Servern (SSR och serverfunktioner)            |
| `SUPABASE_PUBLISHABLE_KEY`      | Servern (SSR och serverfunktioner)            |
| `SUPABASE_SERVICE_ROLE_KEY`     | Endast `client.server.ts` – aldrig i klienten |
| `DATABASE_URL`                  | `drizzle-kit` (migrationer)                   |
| `DEMO_<ROLL>_EMAIL`/`_PASSWORD` | Servern – demoknapparna på `/auth`, se nedan  |

## Skript

```sh
bun run dev        # utvecklingsserver
bun run build      # produktionsbygge till .output/
bun run preview    # förhandsgranska bygget
bun run lint       # eslint
bun run format     # prettier --write .
./scripts/test-db.sh  # migrationer + databastester mot en tom Postgres (PG*-variabler)
```

GitHub Actions (`.github/workflows/ci.yml`) kör typkoll, lint, formatkontroll,
bygge och databastesterna på varje PR och push till main.

## Roller

Behörigheterna finns i `src/lib/permissions.ts` och gäller både menyn och
serverfunktionerna:

| Roll                             | Område         | Kan                                                            |
| -------------------------------- | -------------- | -------------------------------------------------------------- |
| Administratör (`org_admin`)      | `/admin`       | Allt, inklusive inställningar och roller                       |
| Förvaltare (`property_manager`)  | `/admin`       | Allt utom inställningar                                        |
| Styrelseledamot (`board_member`) | `/admin`       | Följa ärenden och ekonomi, sköta information, möten, underhåll |
| Fastighetsskötare (`staff`)      | `/admin`       | Handlägga ärenden, fastigheter, bokningsregler                 |
| Entreprenör (`contractor`)       | `/entreprenor` | Sina tilldelade uppdrag: boka tid, påbörja, markera åtgärdat   |
| Boende (`resident`)              | `/app`         | Sitt boende, felanmälan, bokningar, avgifter, meddelanden      |

Databasens radregler skiljer bara på personal, entreprenör och boende; den
finare uppdelningen mellan personalroller görs i serverfunktionerna.

## Demomiljön

- Demoföreningen BRF Solrosen återställs varje natt kl. 03:00 UTC av
  `public.reset_demo_all()` (pg_cron), med datum räknade från dagens datum.
- "Se demomiljön" på `/auth` loggar in på ett visningskonto per roll (`DEMO_RESIDENT`,
  `DEMO_ADMIN`, `DEMO_BOARD`, `DEMO_STAFF`, `DEMO_CONTRACTOR`) vars uppgifter bara finns
  i miljövariablerna. Konton med `app_metadata.demo_account = true` kan inte
  byta lösenord eller e-post via Auth-API:t.
- Förfrågningar från `/boka-demo` sparas i tabellen `demo_requests` och läses i
  Supabase-dashboarden (Table Editor).

## Filer

Dokument och bilder i felanmälningar ligger i den privata bucketen `files` i
Supabase Storage (`<org>/documents/…` och `<org>/requests/<ärende>/…`). Filer
öppnas via länkar som gäller i en minut, och läsrätten följer dokumentet eller
ärendet de hör till. Demodokumentens filer (`<org>/documents/demo-*`) kan inte
tas bort via API:t.

## Driftsättning

`bun run build` producerar en Nitro-server i `.output/`. Målplattformen detekteras
automatiskt på Vercel, Netlify och Cloudflare; lokalt byggs en Node-server som
startas med `node .output/server/index.mjs`. Sätt `NITRO_PRESET` för att välja
mål uttryckligen.

## Databas

Schema, RLS-policyer och demodata ligger i `supabase/migrations/`. Kompletterande
migrationer hanteras med drizzle i `drizzle/`.

Konton skapas av en administratör – öppen registrering är avstängd
(`enable_signup = false` i `supabase/config.toml` och ska även vara avstängt i
Supabase-projektets auth-inställningar). Nya användare får en profil utan
organisation och roll; koppla organisation, roll (`user_roles`) och boende
(`residencies`) med service role.

## Projektstruktur

```
src/
  routes/               filbaserade routes (TanStack Router)
    _authenticated/     inloggade vyer, app.* för boende och admin.* för förvaltare
  lib/app.functions.ts  serverfunktioner (dataåtkomst via Supabase med användarens JWT)
  integrations/supabase klienter, auth-middleware och genererade typer
  components/           UI-komponenter
supabase/migrations/    SQL-migrationer
drizzle/                drizzle-schema och migrationer
```
