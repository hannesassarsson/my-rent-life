// BankID via en OpenID Connect-leverantör (Criipto/Idura, Signicat m.fl.).
// Leverantören sköter BankID-appen och QR-koden; vi får tillbaka ett
// signerat id_token med personnumret.
//
//   BANKID_OIDC_ISSUER ........ t.ex. https://boendeplattformen-test.criipto.id
//   BANKID_CLIENT_ID .......... klient-id (i Criipto: "Client ID/Realm")
//   BANKID_CLIENT_SECRET ...... klienthemlighet (kodflöde med hemlighet)
//   BANKID_ACR ................ valfri metod, t.ex. urn:grn:authn:se:bankid:same-device
//                               (utan värde visar leverantören sitt eget val)
//   SUPABASE_SERVICE_ROLE_KEY . behövs för att skapa inloggningen i Supabase
//   BILLING_SECRET ............ serverns hemlighet: signerar tillståndet och
//                               är nyckeln för personnummer-HMAC:en
//
// Återkomstadressen hos leverantören ska vara <app>/api/bankid/callback.

import { createHmac, randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { normalizePersonnummer, personnummerHint } from "@/lib/personnummer";
import { serverSecret } from "@/lib/server-db.server";

export function bankIdConfigured() {
  return (
    !!process.env["BANKID_OIDC_ISSUER"] &&
    !!process.env["BANKID_CLIENT_ID"] &&
    !!process.env["BANKID_CLIENT_SECRET"] &&
    !!process.env["SUPABASE_SERVICE_ROLE_KEY"] &&
    !!serverSecret()
  );
}

/* ----------------------------- personnummer ----------------------------- */

/** HMAC av personnumret; samma personnummer ger alltid samma värde. */
export function hashPersonnummer(pnr: string) {
  const secret = serverSecret();
  if (!secret) throw new Error("BankID är inte konfigurerat.");
  return createHmac("sha256", `personnummer:${secret}`).update(pnr).digest("hex");
}

export function personnummerForStorage(raw: string) {
  const pnr = normalizePersonnummer(raw);
  if (!pnr) return null;
  return { hash: hashPersonnummer(pnr), hint: personnummerHint(pnr) };
}

/* ------------------------- signerade småtillstånd ------------------------ */

const b64url = (buf: Buffer) => buf.toString("base64url");

function stateKey() {
  const secret = serverSecret();
  if (!secret) throw new Error("BankID är inte konfigurerat.");
  return `bankid-state:${secret}`;
}

/** Signerar ett litet JSON-värde som ska förbi webbläsaren (cookie, länk). */
export function sealState(value: Record<string, unknown>, ttlSeconds: number) {
  const payload = b64url(
    Buffer.from(JSON.stringify({ ...value, exp: Math.floor(Date.now() / 1000) + ttlSeconds })),
  );
  const sig = b64url(createHmac("sha256", stateKey()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function openState<T extends Record<string, unknown>>(sealed: string | null | undefined) {
  if (!sealed) return null;
  const [payload, sig] = sealed.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", stateKey()).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T & {
      exp: number;
    };
    return value.exp > Date.now() / 1000 ? value : null;
  } catch {
    return null;
  }
}

export function randomToken(bytes = 24) {
  return b64url(randomBytes(bytes));
}

export function pkceChallenge(verifier: string) {
  return b64url(createHash("sha256").update(verifier).digest());
}

/* ------------------------------- OIDC ------------------------------- */

type Discovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

let discoveryCache: { issuer: string; doc: Discovery; at: number } | null = null;

export async function discovery(): Promise<Discovery> {
  const issuer = (process.env["BANKID_OIDC_ISSUER"] ?? "").replace(/\/$/, "");
  if (discoveryCache?.issuer === issuer && Date.now() - discoveryCache.at < 3600_000) {
    return discoveryCache.doc;
  }
  const res = await fetch(`${issuer}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`BankID-leverantören svarade ${res.status}`);
  const doc = (await res.json()) as Discovery;
  discoveryCache = { issuer, doc, at: Date.now() };
  return doc;
}

export async function authorizeUrl(opts: {
  redirectUri: string;
  state: string;
  nonce: string;
  verifier: string;
}) {
  const d = await discovery();
  const url = new URL(d.authorization_endpoint);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env["BANKID_CLIENT_ID"] ?? "",
    redirect_uri: opts.redirectUri,
    scope: "openid",
    state: opts.state,
    nonce: opts.nonce,
    code_challenge: pkceChallenge(opts.verifier),
    code_challenge_method: "S256",
    ui_locales: "sv",
  });
  // Utan BANKID_ACR visar leverantören sitt eget val (samma enhet eller QR).
  const acr = process.env["BANKID_ACR"];
  if (acr) params.set("acr_values", acr);
  url.search = params.toString();
  return url.toString();
}

type Jwk = JsonWebKey & { kid?: string; alg?: string };

async function signingKey(jwksUri: string, kid: string | undefined) {
  const res = await fetch(jwksUri);
  if (!res.ok) throw new Error("Kunde inte hämta BankID-leverantörens nycklar");
  const { keys } = (await res.json()) as { keys: Jwk[] };
  const jwk = keys.find((k) => k.kty === "RSA" && (!kid || k.kid === kid));
  if (!jwk) throw new Error("Okänd signeringsnyckel");
  return crypto.subtle.importKey(
    "jwk",
    { kty: "RSA", n: jwk.n, e: jwk.e, ext: true } as JsonWebKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

/** Kontrollerar id_token (RS256) och returnerar dess uppgifter. */
export async function verifyIdToken(idToken: string, expectedNonce: string) {
  const d = await discovery();
  const [h, p, s] = idToken.split(".");
  if (!h || !p || !s) throw new Error("Ogiltigt svar från BankID");
  const header = JSON.parse(Buffer.from(h, "base64url").toString("utf8")) as {
    alg: string;
    kid?: string;
  };
  if (header.alg !== "RS256") throw new Error("Oväntad signaturalgoritm");
  const key = await signingKey(d.jwks_uri, header.kid);
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    Buffer.from(s, "base64url"),
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) throw new Error("Ogiltig signatur från BankID");
  const claims = JSON.parse(Buffer.from(p, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
  const now = Date.now() / 1000;
  const aud = claims["aud"];
  const clientId = process.env["BANKID_CLIENT_ID"];
  if (claims["iss"] !== d.issuer) throw new Error("Fel utfärdare");
  if (!(aud === clientId || (Array.isArray(aud) && aud.includes(clientId)))) {
    throw new Error("Fel mottagare");
  }
  if (typeof claims["exp"] !== "number" || claims["exp"] < now - 60) {
    throw new Error("Legitimeringen har gått ut");
  }
  if (claims["nonce"] !== expectedNonce) throw new Error("Fel engångsvärde");
  return claims;
}

/** Personnumret ur leverantörens uppgifter (namnet skiljer mellan leverantörer). */
export function personnummerFromClaims(claims: Record<string, unknown>) {
  for (const name of ["ssn", "nin", "personal_identity_number", "socialno", "sub"]) {
    const v = claims[name];
    if (typeof v === "string") {
      const pnr = normalizePersonnummer(v.replace(/^SE/i, ""));
      if (pnr) return pnr;
    }
  }
  return null;
}

export async function exchangeCode(code: string, redirectUri: string, verifier: string) {
  const d = await discovery();
  const id = encodeURIComponent(process.env["BANKID_CLIENT_ID"] ?? "");
  const secret = encodeURIComponent(process.env["BANKID_CLIENT_SECRET"] ?? "");
  const res = await fetch(d.token_endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!res.ok || !json.id_token) {
    throw new Error(`BankID-leverantören svarade ${res.status} ${json.error ?? ""}`.trim());
  }
  return json.id_token;
}

/* ---------------------------- Supabase-session --------------------------- */

/**
 * Engångskod som webbläsaren byter mot en session (supabase.auth.verifyOtp).
 * Kräver tjänstenyckeln, som bara finns på servern.
 */
export async function createLoginToken(email: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("BankID är inte konfigurerat.");
  const admin = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Nya nycklar (sb_secret_…) skickas bara som apikey; äldre JWT-nycklar
      // behöver även Authorization.
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) {
    throw new Error(error?.message ?? "Kunde inte skapa inloggningen");
  }
  return data.properties.hashed_token;
}
