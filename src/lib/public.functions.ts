import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Serverfunktioner som inte kräver inloggning: demoinloggning och
// förfrågningar från "Boka demo".

function anonClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Tjänsten är inte konfigurerad.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Publishable-nycklar (sb_publishable_...) är inte JWT:er och får inte
      // skickas som Bearer-token, bara som apikey.
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/** Demoroll → prefix för miljövariablerna <PREFIX>_EMAIL och <PREFIX>_PASSWORD. */
const DEMO_KINDS = {
  resident: "DEMO_RESIDENT",
  admin: "DEMO_ADMIN",
  board: "DEMO_BOARD",
  staff: "DEMO_STAFF",
  contractor: "DEMO_CONTRACTOR",
} as const;

export type DemoKind = keyof typeof DEMO_KINDS;

/**
 * Loggar in på ett av demokontona. Uppgifterna finns bara som miljövariabler
 * på servern; klienten får tillbaka en session att använda.
 */
export const startDemo = createServerFn({ method: "POST" })
  .inputValidator(z.object({ kind: z.enum(Object.keys(DEMO_KINDS) as [DemoKind, ...DemoKind[]]) }))
  .handler(async ({ data }) => {
    const prefix = DEMO_KINDS[data.kind];
    const email = process.env[`${prefix}_EMAIL`];
    const password = process.env[`${prefix}_PASSWORD`];
    if (!email || !password) throw new Error("Demomiljön är inte tillgänglig just nu.");

    const { data: auth, error } = await anonClient().auth.signInWithPassword({ email, password });
    if (error || !auth.session) throw new Error("Demomiljön är inte tillgänglig just nu.");
    return {
      accessToken: auth.session.access_token,
      refreshToken: auth.session.refresh_token,
    };
  });

export const demoRequestSchema = z.object({
  name: z.string().trim().min(1, "Fyll i ditt namn").max(200),
  email: z.string().trim().email("Ange en giltig e-postadress").max(200),
  organization: z.string().trim().min(1, "Fyll i organisation").max(200),
  orgType: z.enum(["brf", "landlord", "manager", "other"]),
  unitCount: z.number().int().min(1).max(100_000).optional(),
  message: z.string().trim().max(4000).optional(),
  // Fält som är dolt för människor; fylls det i är det en bot.
  website: z.string().max(200).optional(),
});

export const requestDemo = createServerFn({ method: "POST" })
  .inputValidator(demoRequestSchema)
  .handler(async ({ data }) => {
    if (data.website) return { ok: true };
    const { error } = await anonClient()
      .from("demo_requests")
      .insert({
        name: data.name,
        email: data.email,
        organization: data.organization,
        org_type: data.orgType,
        unit_count: data.unitCount ?? null,
        message: data.message || null,
      });
    if (error) throw new Error("Förfrågan kunde inte skickas. Försök igen.");
    return { ok: true };
  });
