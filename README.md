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

## Skript

```sh
bun run dev        # utvecklingsserver
bun run build      # produktionsbygge till .output/
bun run preview    # förhandsgranska bygget
bun run lint       # eslint
bun run format     # prettier --write .
```

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
