import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/**
 * Databasklient för servern utan inloggad användare. Den använder den
 * publika nyckeln; funktionerna den anropar kräver serverns hemlighet
 * (BILLING_SECRET), som bara finns på servern.
 */
export function serverDb() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Tjänsten är inte konfigurerad.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Publishable-nycklar skickas bara som apikey, inte som Bearer-token.
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export function serverSecret() {
  return process.env["BILLING_SECRET"] ?? null;
}

/** Appens adress i länkar som skickas ut. */
export function appUrl() {
  const explicit = process.env["APP_URL"];
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env["VERCEL_PROJECT_PRODUCTION_URL"];
  return vercel ? `https://${vercel}` : "https://boendeplattformen.vercel.app";
}
