import { createFileRoute } from "@tanstack/react-router";

import { flushDeliveries } from "@/lib/delivery.server";

/**
 * Skickar köade utskick (e-post och sms). Anropas av Vercels schemalagda
 * jobb, som skickar CRON_SECRET som Bearer-token. Utskicken skickas annars
 * direkt när notiserna skapas; det här fångar upp omförsök.
 */
export const Route = createFileRoute("/api/utskick")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cronSecret = process.env["CRON_SECRET"];
        if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
          return new Response("Behörighet saknas", { status: 401 });
        }
        try {
          const result = await flushDeliveries({ budgetMs: 50_000 });
          return Response.json(result);
        } catch (e) {
          console.error(`Utskick: ${e instanceof Error ? e.message : String(e)}`);
          return new Response("Utskicken kunde inte skickas", { status: 500 });
        }
      },
    },
  },
});
