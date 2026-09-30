import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/app-shell";
import { BankIdMark } from "@/components/bankid";

export const Route = createFileRoute("/auth_/bankid")({
  ssr: false,
  head: () => ({ meta: [{ title: "Loggar in med BankID – Boendeplattformen" }] }),
  component: BankIdCompletePage,
});

/**
 * Hit skickar servern webbläsaren efter en godkänd BankID-legitimering, med
 * en engångskod i adressens fragment (den når aldrig någon server). Koden
 * byts mot en session och användaren skickas vidare.
 */
function BankIdCompletePage() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("t");
    const next = params.get("next");
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      setFailed(true);
      return;
    }
    void (async () => {
      await supabase.auth.signOut({ scope: "local" });
      const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: "magiclink" });
      if (error) {
        setFailed(true);
        return;
      }
      const target = next && /^\/(?!\/)/.test(next) ? next : "/app";
      void navigate({ href: target, replace: true });
    })();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        {failed ? (
          <>
            <h1 className="mt-10 text-xl font-semibold">Inloggningen gick inte igenom</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Länken från BankID har redan använts eller gått ut.
            </p>
            <Link
              to="/auth"
              className="mt-6 inline-block text-sm text-primary underline-offset-4 hover:underline"
            >
              Tillbaka till inloggningen
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto mt-10 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <BankIdMark className="size-6 animate-pulse" />
            </div>
            <h1 className="mt-4 text-xl font-semibold">Loggar in…</h1>
            <p className="mt-2 text-sm text-muted-foreground">Du är legitimerad med BankID.</p>
          </>
        )}
      </div>
    </div>
  );
}
