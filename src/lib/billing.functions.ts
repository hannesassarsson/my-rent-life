import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { requirePermission } from "@/lib/app.functions";
import { BILLING_INTERVALS, PLAN_IDS, billableUnits, type PlanId } from "@/lib/plans";
import {
  billingDataFrom,
  ensurePortalConfiguration,
  ensurePrice,
  ensureVatRate,
  getStripe,
  saveBilling,
  stripeConfigured,
  stripeMode,
} from "@/lib/stripe.server";

type Db = SupabaseClient<Database>;

/** Hämtas om från Stripe när uppgifterna är äldre än så här. */
const SYNC_AFTER_MS = 10 * 60_000;

async function loadBilling(supabase: Db, orgId: string) {
  const [sub, units] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("organization_id", orgId).maybeSingle(),
    supabase
      .from("units")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
  ]);
  if (sub.error) throw new Error(sub.error.message);
  return { subscription: sub.data, units: units.count ?? 0 };
}

type Subscription = NonNullable<Awaited<ReturnType<typeof loadBilling>>["subscription"]>;

/** Stripe-uppgifterna gäller bara i det läge (test/live) de skapades i. */
function inCurrentMode(sub: Subscription | null) {
  return !!sub && sub.stripe_mode === stripeMode();
}

/** Hämtar abonnemanget från Stripe och sparar det; håller antalet lägenheter i fas. */
async function syncFromStripe(orgId: string, sub: Subscription, units: number) {
  if (!inCurrentMode(sub) || !sub.stripe_subscription_id) return;
  const stripe = getStripe();
  let remote = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
  const item = remote.items.data[0];
  const plan = billingDataFrom(remote).plan;
  const wanted = plan ? billableUnits(plan, units) : null;
  // Ändrat antal lägenheter debiteras från nästa period.
  if (
    item &&
    wanted &&
    item.quantity !== wanted &&
    ["active", "trialing", "past_due"].includes(remote.status)
  ) {
    remote = await stripe.subscriptions.update(remote.id, {
      items: [{ id: item.id, quantity: wanted }],
      proration_behavior: "none",
    });
  }
  await saveBilling({ organizationId: orgId }, billingDataFrom(remote));
}

export const getBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { me, orgId } = await requirePermission(supabase, context.userId, "settings.edit");
    let billing = await loadBilling(supabase, orgId);
    const configured = stripeConfigured();
    const sub = billing.subscription;
    if (
      configured &&
      sub &&
      !sub.is_demo &&
      inCurrentMode(sub) &&
      sub.stripe_subscription_id &&
      (!sub.synced_at || Date.now() - new Date(sub.synced_at).getTime() > SYNC_AFTER_MS)
    ) {
      try {
        await syncFromStripe(orgId, sub, billing.units);
        billing = await loadBilling(supabase, orgId);
      } catch (e) {
        console.error("Synk mot Stripe:", e);
      }
    }
    const current = billing.subscription;
    return {
      organization: me.organization,
      units: billing.units,
      subscription: current
        ? {
            plan: current.plan as PlanId,
            status: current.status,
            billingInterval: current.billing_interval,
            trialEndsAt: current.trial_ends_at,
            currentPeriodEnd: current.current_period_end,
            cancelAtPeriodEnd: current.cancel_at_period_end,
            pastDueSince: current.past_due_since,
            unitsBilled: current.units_billed,
            isDemo: current.is_demo,
            invoiceBilling: current.invoice_billing,
            hasStripeSubscription: inCurrentMode(current) && !!current.stripe_subscription_id,
            hasStripeCustomer: inCurrentMode(current) && !!current.stripe_customer_id,
          }
        : null,
      access: me.access,
      configured,
      testMode: stripeMode() === "test",
    };
  });

const checkoutSchema = z.object({
  plan: z.enum(PLAN_IDS),
  interval: z.enum(BILLING_INTERVALS),
});

/**
 * Startar ett köp i Stripe Checkout, eller byter plan direkt om det redan
 * finns ett abonnemang. Återstående provperiod följer med.
 */
export const startCheckout = createServerFn({ method: "POST" })
  .inputValidator(checkoutSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { me, orgId } = await requirePermission(supabase, context.userId, "settings.edit");
    const { subscription: sub, units } = await loadBilling(supabase, orgId);
    if (sub?.is_demo) throw new Error("Demoföreningen kan inte teckna abonnemang.");
    const stripe = getStripe();
    const [price, vat] = await Promise.all([
      ensurePrice(stripe, data.plan, data.interval),
      ensureVatRate(stripe),
    ]);
    const quantity = billableUnits(data.plan, units);

    // Befintligt abonnemang: byt pris i stället för att starta ett nytt.
    if (sub && inCurrentMode(sub) && sub.stripe_subscription_id) {
      const remote = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
      const item = remote.items.data[0];
      if (item && !["canceled", "incomplete_expired"].includes(remote.status)) {
        const updated = await stripe.subscriptions.update(remote.id, {
          items: [{ id: item.id, price: price.id, quantity }],
          metadata: { organization_id: orgId, plan: data.plan },
          proration_behavior: "create_prorations",
          cancel_at_period_end: false,
        });
        await saveBilling({ organizationId: orgId }, billingDataFrom(updated));
        return { url: null, changed: true };
      }
    }

    // En kund per organisation och läge.
    let customerId = inCurrentMode(sub) ? (sub?.stripe_customer_id ?? null) : null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        ...(me.organization?.name ? { name: me.organization.name } : {}),
        ...(me.profile?.email ? { email: me.profile.email } : {}),
        preferred_locales: ["sv"],
        metadata: { organization_id: orgId },
      });
      customerId = customer.id;
      await saveBilling(
        { organizationId: orgId },
        { stripe_customer_id: customerId, stripe_mode: stripeMode() },
      );
    }

    // Stripe kräver att en provperiod slutar minst två dygn fram.
    const trialEnd =
      sub?.status === "trialing" && sub.trial_ends_at
        ? Math.floor(new Date(sub.trial_ends_at).getTime() / 1000)
        : null;
    const keepTrial = trialEnd && trialEnd * 1000 > Date.now() + 49 * 3600_000;

    const origin = new URL(getRequest().url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: price.id, quantity }],
      subscription_data: {
        default_tax_rates: [vat.id],
        metadata: { organization_id: orgId, plan: data.plan },
        ...(keepTrial ? { trial_end: trialEnd } : {}),
      },
      metadata: { organization_id: orgId, plan: data.plan },
      client_reference_id: orgId,
      locale: "sv",
      // Alltid kronor: ingen växling till kundens lokala valuta.
      adaptive_pricing: { enabled: false },
      allow_promotion_codes: true,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      customer_update: { name: "auto", address: "auto" },
      success_url: `${origin}/admin/abonnemang?kop={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/admin/abonnemang`,
    });
    if (!session.url) throw new Error("Betalningen kunde inte startas.");
    return { url: session.url, changed: false };
  });

/** Körs när användaren kommer tillbaka från Stripe Checkout. */
export const confirmCheckout = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string().startsWith("cs_").max(200) }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "settings.edit");
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
      expand: ["subscription"],
    });
    if (session.metadata?.["organization_id"] !== orgId) throw new Error("Köpet hittades inte.");
    const sub = session.subscription as Stripe.Subscription | null;
    if (!sub || typeof sub === "string") return { ok: false };
    await saveBilling({ organizationId: orgId }, billingDataFrom(sub));
    return { ok: true };
  });

/** Stripes kundportal: kort, kvitton, fakturauppgifter och uppsägning. */
export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "settings.edit");
    const { subscription: sub } = await loadBilling(supabase, orgId);
    if (!sub?.stripe_customer_id || !inCurrentMode(sub)) {
      throw new Error("Det finns inget abonnemang att hantera ännu.");
    }
    const stripe = getStripe();
    const config = await ensurePortalConfiguration(stripe);
    const origin = new URL(getRequest().url).origin;
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      configuration: config.id,
      locale: "sv",
      return_url: `${origin}/admin/abonnemang`,
    });
    return { url: portal.url };
  });
