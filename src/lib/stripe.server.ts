// Stripe på serversidan. Nycklarna finns bara som miljövariabler på servern.
//
//   STRIPE_LIVE=true ........ riktiga betalningar med STRIPE_SECRET_KEY
//   annars .................. testläge med STRIPE_TEST_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET / STRIPE_TEST_WEBHOOK_SECRET  signaturer från Stripe
//   BILLING_SECRET .......... visas upp för apply_billing i databasen
//
// Produkter, priser, moms och kundportalen skapas i Stripe första gången de
// behövs, så att samma kod fungerar i test- och liveläge utan manuellt arbete
// i Stripes gränssnitt.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/integrations/supabase/types";
import {
  ADDON_IDS,
  ADDONS,
  PLAN_IDS,
  PLANS,
  type AddonId,
  YEARLY_MONTHS_CHARGED,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans";

export type StripeMode = "test" | "live";

export function stripeMode(): StripeMode {
  return process.env["STRIPE_LIVE"] === "true" ? "live" : "test";
}

let cached: { mode: StripeMode; client: Stripe } | null = null;

export function stripeConfigured() {
  const key =
    stripeMode() === "live"
      ? process.env["STRIPE_SECRET_KEY"]
      : process.env["STRIPE_TEST_SECRET_KEY"];
  return !!key && !!process.env["BILLING_SECRET"];
}

export function getStripe(): Stripe {
  const mode = stripeMode();
  if (cached?.mode === mode) return cached.client;
  const key =
    mode === "live" ? process.env["STRIPE_SECRET_KEY"] : process.env["STRIPE_TEST_SECRET_KEY"];
  if (!key) throw new Error("Betalningen är inte konfigurerad ännu.");
  cached = { mode, client: new Stripe(key, { appInfo: { name: "Boendeplattformen" } }) };
  return cached.client;
}

/* ------------------------------ PRISER ------------------------------ */

type CatalogItem = {
  productId: string;
  name: string;
  description: string;
  /** Kronor per lägenhet och månad */
  perUnit: number;
  metadata: Record<string, string>;
};

function catalogItem(kind: "plan" | "addon", id: string): CatalogItem {
  if (kind === "plan") {
    const plan = PLANS[id as PlanId];
    return {
      productId: `bp_${plan.id}`,
      name: `Boendeplattformen ${plan.name}`,
      description: `${plan.tagline}. Pris per lägenhet.`,
      perUnit: plan.perUnit,
      metadata: { plan: plan.id },
    };
  }
  const addon = ADDONS[id as AddonId];
  return {
    productId: `bp_addon_${addon.id}`,
    name: `Tillägg: ${addon.name}`,
    description: `${addon.description}. Pris per lägenhet.`,
    perUnit: addon.perUnit,
    metadata: { addon: addon.id },
  };
}

async function ensureProduct(stripe: Stripe, item: CatalogItem) {
  try {
    return await stripe.products.retrieve(item.productId);
  } catch (e) {
    if ((e as { code?: string }).code !== "resource_missing") throw e;
    return stripe.products.create({
      id: item.productId,
      name: item.name,
      description: item.description,
      metadata: item.metadata,
    });
  }
}

async function ensureCatalogPrice(stripe: Stripe, item: CatalogItem, interval: BillingInterval) {
  const key = `${item.productId}_${interval}_v1`;
  const found = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  if (found.data[0]) return found.data[0];
  const product = await ensureProduct(stripe, item);
  const perMonth = item.perUnit * 100;
  return stripe.prices.create({
    product: product.id,
    currency: "sek",
    unit_amount: interval === "year" ? perMonth * YEARLY_MONTHS_CHARGED : perMonth,
    recurring: { interval },
    tax_behavior: "exclusive",
    lookup_key: key,
    nickname: `${item.name} per lägenhet (${interval === "year" ? "år" : "månad"})`,
    metadata: { ...item.metadata, interval },
  });
}

/** Priset per lägenhet för en plan och betalperiod, skapas vid behov. */
export function ensurePrice(stripe: Stripe, plan: PlanId, interval: BillingInterval) {
  return ensureCatalogPrice(stripe, catalogItem("plan", plan), interval);
}

/** Priset per lägenhet för ett tillägg och betalperiod, skapas vid behov. */
export function ensureAddonPrice(stripe: Stripe, addon: AddonId, interval: BillingInterval) {
  return ensureCatalogPrice(stripe, catalogItem("addon", addon), interval);
}

/** Svensk moms 25 %, skapas en gång. */
export async function ensureVatRate(stripe: Stripe) {
  const rates = await stripe.taxRates.list({ active: true, limit: 100 });
  const found = rates.data.find((r) => r.metadata?.["bp"] === "moms25");
  if (found) return found;
  return stripe.taxRates.create({
    display_name: "Moms",
    percentage: 25,
    inclusive: false,
    country: "SE",
    jurisdiction: "Sverige",
    metadata: { bp: "moms25" },
  });
}

/** Kundportalen (kort, kvitton, uppsägning), skapas en gång. */
export async function ensurePortalConfiguration(stripe: Stripe) {
  const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 20 });
  const found = configs.data.find((c) => c.metadata?.["bp"] === "portal_v1");
  if (found) return found;
  return stripe.billingPortal.configurations.create({
    business_profile: { headline: "Boendeplattformen – abonnemang och kvitton" },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ["email", "address", "name", "tax_id"] },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
    },
    metadata: { bp: "portal_v1" },
  });
}

/* --------------------------- ABONNEMANGET --------------------------- */

export type BillingData = {
  plan?: PlanId;
  status?: string;
  billing_interval?: BillingInterval;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  units_billed?: number;
  addons?: AddonId[];
  stripe_mode?: StripeMode;
  stripe_customer_id?: string;
  stripe_subscription_id?: string | null;
};

const iso = (unix: number | null | undefined) =>
  unix ? new Date(unix * 1000).toISOString() : null;

/** Stripes abonnemang översatt till raden i subscriptions. */
export function billingDataFrom(sub: Stripe.Subscription): BillingData {
  const items = sub.items.data;
  // Grundpaketet är raden vars pris hör till en plan; övriga rader är tillägg.
  const base = items.find((i) => i.price.metadata?.["plan"]) ?? items[0];
  const metaPlan = sub.metadata?.["plan"];
  const pricePlan = base?.price.metadata?.["plan"];
  const plan = [pricePlan, metaPlan].find((p): p is PlanId =>
    (PLAN_IDS as readonly string[]).includes(p ?? ""),
  );
  const addons = items
    .map((i) => i.price.metadata?.["addon"])
    .filter((a): a is AddonId => (ADDON_IDS as readonly string[]).includes(a ?? ""));
  const interval = base?.price.recurring?.interval;
  return {
    ...(plan ? { plan } : {}),
    status: sub.status,
    ...(interval === "month" || interval === "year" ? { billing_interval: interval } : {}),
    trial_ends_at: iso(sub.trial_end),
    current_period_end: iso(base?.current_period_end),
    cancel_at_period_end: sub.cancel_at_period_end || !!sub.cancel_at,
    ...(base?.quantity ? { units_billed: base.quantity } : {}),
    addons,
    stripe_mode: sub.livemode ? "live" : "test",
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
  };
}

function billingDb() {
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

/**
 * Sparar abonnemangsuppgifter. Databasen tar bara emot dem tillsammans med
 * serverns hemlighet, så en inloggad användare kan inte ändra sin egen plan.
 */
export async function saveBilling(
  target: { organizationId?: string | null; customerId?: string | null },
  data: BillingData,
) {
  const secret = process.env["BILLING_SECRET"];
  if (!secret) throw new Error("Betalningen är inte konfigurerad ännu.");
  const { data: orgId, error } = await billingDb().rpc("apply_billing", {
    _secret: secret,
    _organization_id: target.organizationId ?? null,
    _stripe_customer_id: target.customerId ?? null,
    _data: data as Json,
  });
  if (error) throw new Error(error.message);
  return orgId;
}
