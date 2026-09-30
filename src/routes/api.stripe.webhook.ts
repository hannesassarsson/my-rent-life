import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";

import { billingDataFrom, getStripe, saveBilling } from "@/lib/stripe.server";

/**
 * Tar emot händelser från Stripe (betalning, misslyckad betalning,
 * uppsägning) och uppdaterar abonnemanget. Signaturen kontrolleras mot
 * STRIPE_WEBHOOK_SECRET eller, i testläge, STRIPE_TEST_WEBHOOK_SECRET.
 */
export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("stripe-signature");
        const body = await request.text();
        const secrets = [
          process.env["STRIPE_WEBHOOK_SECRET"],
          process.env["STRIPE_TEST_WEBHOOK_SECRET"],
        ].filter((s): s is string => !!s);
        if (!signature || secrets.length === 0)
          return new Response("Saknar signatur", { status: 400 });

        const stripe = getStripe();
        let event: Stripe.Event | null = null;
        for (const secret of secrets) {
          try {
            event = await stripe.webhooks.constructEventAsync(body, signature, secret);
            break;
          } catch {
            // Prova nästa hemlighet.
          }
        }
        if (!event) return new Response("Ogiltig signatur", { status: 400 });

        try {
          await handleEvent(stripe, event);
        } catch (e) {
          console.error("Stripe-händelse", event.type, e);
          // 500 gör att Stripe försöker igen senare.
          return new Response("Kunde inte behandla händelsen", { status: 500 });
        }
        return new Response("ok");
      },
    },
  },
});

async function handleEvent(stripe: Stripe, event: Stripe.Event) {
  let subscriptionId: string | null = null;
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      subscriptionId = event.data.object.id;
      break;
    case "checkout.session.completed": {
      const sub = event.data.object.subscription;
      subscriptionId = typeof sub === "string" ? sub : (sub?.id ?? null);
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const details = event.data.object.parent?.subscription_details?.subscription;
      subscriptionId = typeof details === "string" ? details : (details?.id ?? null);
      break;
    }
    default:
      return;
  }
  if (!subscriptionId) return;

  // Hämta alltid det aktuella läget i stället för att lita på händelsens
  // ordning; Stripe skickar inte händelser i garanterad ordning.
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const orgId = sub.metadata?.["organization_id"] ?? null;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  await saveBilling({ organizationId: orgId, customerId }, billingDataFrom(sub));
}
