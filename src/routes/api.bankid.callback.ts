import { createFileRoute } from "@tanstack/react-router";

import {
  createLoginToken,
  exchangeCode,
  openState,
  personnummerFromClaims,
  personnummerForStorage,
  verifyIdToken,
} from "@/lib/bankid.server";
import { STATE_COOKIE, readCookie, redirectTo, stateCookie } from "@/lib/bankid-http.server";
import { serverDb, serverSecret } from "@/lib/server-db.server";

type Flow = {
  mode: "login" | "link";
  state: string;
  nonce: string;
  verifier: string;
  uid?: string;
  back?: string;
  redirect?: string | null;
};

const LINK_RESULT: Record<string, string> = {
  linked: "kopplat",
  taken: "upptaget",
  demo: "demo",
};

/** Återkomsten från BankID-leverantören: logga in eller koppla kontot. */
export const Route = createFileRoute("/api/bankid/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const clear = stateCookie(url, "", 0);
        const flow = openState<Flow>(readCookie(request, STATE_COOKIE));
        const failPath = (code: string) =>
          flow?.mode === "link"
            ? `${flow.back ?? "/app/profil"}?bankid=${code}`
            : `/auth?bankid=${code}`;

        if (!flow || flow.state !== url.searchParams.get("state")) {
          return redirectTo(url, "/auth?bankid=ogiltig", clear);
        }
        if (url.searchParams.get("error")) return redirectTo(url, failPath("avbrutet"), clear);
        const code = url.searchParams.get("code");
        if (!code) return redirectTo(url, failPath("fel"), clear);

        try {
          const idToken = await exchangeCode(
            code,
            `${url.origin}/api/bankid/callback`,
            flow.verifier,
          );
          const claims = await verifyIdToken(idToken, flow.nonce);
          const pnr = personnummerFromClaims(claims);
          const stored = pnr ? personnummerForStorage(pnr) : null;
          if (!stored) {
            return redirectTo(url, failPath("okand-legitimation"), clear);
          }
          const db = serverDb();
          const secret = serverSecret()!;

          if (flow.mode === "link" && flow.uid) {
            const { data, error } = await db.rpc("link_bankid", {
              _secret: secret,
              _user_id: flow.uid,
              _pnr_hash: stored.hash,
              _hint: stored.hint,
            });
            if (error) throw new Error(error.message);
            const back = flow.back ?? "/app/profil";
            return redirectTo(url, `${back}?bankid=${LINK_RESULT[data ?? ""] ?? "fel"}`, clear);
          }

          const { data: rows, error } = await db.rpc("bankid_login", {
            _secret: secret,
            _pnr_hash: stored.hash,
          });
          if (error) throw new Error(error.message);
          const account = rows?.[0];
          if (!account?.email) return redirectTo(url, "/auth?bankid=inget-konto", clear);
          const token = await createLoginToken(account.email);
          const next = flow.redirect ? `&next=${encodeURIComponent(flow.redirect)}` : "";
          return redirectTo(url, `/auth/bankid#t=${encodeURIComponent(token)}${next}`, clear);
        } catch (e) {
          console.error(`BankID: ${e instanceof Error ? e.message : String(e)}`);
          return redirectTo(url, failPath("fel"), clear);
        }
      },
    },
  },
});
