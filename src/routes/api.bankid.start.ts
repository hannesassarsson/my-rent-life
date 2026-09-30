import { createFileRoute } from "@tanstack/react-router";

import {
  authorizeUrl,
  bankIdConfigured,
  openState,
  randomToken,
  sealState,
} from "@/lib/bankid.server";
import { redirectTo, stateCookie } from "@/lib/bankid-http.server";

const localPath = (v: string | null) => (v && /^\/(?!\/)/.test(v) && v.length < 500 ? v : null);

/**
 * Startar en BankID-legitimering hos leverantören.
 *   ?redirect=/app/...  inloggning, därefter dit
 *   ?ticket=...         koppla BankID till det inloggade kontot (biljetten
 *                       skapas av createBankIdLinkTicket)
 */
export const Route = createFileRoute("/api/bankid/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (!bankIdConfigured()) return redirectTo(url, "/auth?bankid=ej-aktiverat");

        const ticket = url.searchParams.get("ticket");
        let flow: Record<string, unknown>;
        if (ticket) {
          const link = openState<{ purpose: string; uid: string; back: string }>(ticket);
          if (!link || link.purpose !== "link") {
            return redirectTo(url, "/auth?bankid=ogiltig");
          }
          flow = { mode: "link", uid: link.uid, back: link.back };
        } else {
          flow = { mode: "login", redirect: localPath(url.searchParams.get("redirect")) };
        }

        const state = randomToken();
        const nonce = randomToken();
        const verifier = randomToken(32);
        try {
          const location = await authorizeUrl({
            redirectUri: `${url.origin}/api/bankid/callback`,
            state,
            nonce,
            verifier,
          });
          return new Response(null, {
            status: 302,
            headers: {
              Location: location,
              "Set-Cookie": stateCookie(
                url,
                sealState({ ...flow, state, nonce, verifier }, 600),
                600,
              ),
              "Cache-Control": "no-store",
            },
          });
        } catch (e) {
          console.error(`BankID start: ${e instanceof Error ? e.message : String(e)}`);
          return redirectTo(url, `${ticket ? "/app/profil" : "/auth"}?bankid=fel`);
        }
      },
    },
  },
});
