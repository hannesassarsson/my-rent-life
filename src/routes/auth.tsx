import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/app-shell";
import { requestPasswordReset, startDemo, type DemoKind } from "@/lib/public.functions";
import { getBankIdAvailability } from "@/lib/bankid.functions";
import { BankIdLoginButton, useBankIdResultToast } from "@/components/bankid";

const DEMO_ROLES: { kind: DemoKind; label: string; description: string; to: string }[] = [
  { kind: "resident", label: "Boende", description: "Avgift, felanmälan, bokningar", to: "/app" },
  { kind: "admin", label: "Förvaltare", description: "Hela administrationen", to: "/admin" },
  { kind: "board", label: "Styrelse", description: "Ekonomi, möten, information", to: "/admin" },
  {
    kind: "staff",
    label: "Fastighetsskötare",
    description: "Ärenden och fastigheter",
    to: "/admin",
  },
  {
    kind: "contractor",
    label: "Entreprenör",
    description: "Tilldelade uppdrag",
    to: "/entreprenor",
  },
];

const AREA_HOMES = { resident: "/app", admin: "/admin", contractor: "/entreprenor" };

/** Ett anrop som inte svarar ska ge ett fel i stället för att knappen hänger. */
function withTimeout<T>(promise: Promise<T>, ms = 20_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error("Det tog för lång tid. Ladda om sidan och försök igen.")),
        ms,
      ),
    ),
  ]);
}

/** Bara adresser inom appen, så att inloggningen inte kan skicka vidare till andra sajter. */
const localPath = z
  .string()
  .regex(/^\/(?!\/)/)
  .max(500)
  .optional()
  .catch(undefined);

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: localPath }),
  head: () => ({
    meta: [
      { title: "Logga in – Boendeplattformen" },
      {
        name: "description",
        content:
          "Logga in på Boendeplattformen för att se din avgift eller hyra, felanmälningar, bokningar och information från föreningen.",
      },
      { property: "og:title", content: "Logga in – Boendeplattformen" },
      {
        property: "og:description",
        content: "Allt som rör ditt boende – på ett ställe.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const goHome = (fallback: string) =>
    redirect
      ? navigate({ href: redirect, replace: true })
      : navigate({ to: fallback, replace: true });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const startDemoFn = useServerFn(startDemo);
  const resetFn = useServerFn(requestPasswordReset);
  const [mode, setMode] = useState<"login" | "reset" | "sent">("login");
  const [demoKind, setDemoKind] = useState<DemoKind | null>(null);
  const bankIdFn = useServerFn(getBankIdAvailability);
  const { data: bankId } = useQuery({
    queryKey: ["bankid-availability"],
    queryFn: () => bankIdFn(),
    staleTime: 5 * 60_000,
  });
  useBankIdResultToast();

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await resetFn({ data: { email } });
      setMode("sent");
    } catch {
      toast.error("Ange en giltig e-postadress");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // Fråga servern om sessionen fortfarande gäller. En utgången session i
    // webbläsaren får inte skicka runt användaren mellan sidorna; då loggas
    // den ut lokalt så att inloggning och demoknappar fungerar.
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { data: user, error } = await supabase.auth.getUser();
      if (user.user && !error) void goHome("/app");
      else await supabase.auth.signOut({ scope: "local" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      void goHome("/app");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Något gick fel");
    } finally {
      setBusy(false);
    }
  }

  async function demoLogin(kind: DemoKind) {
    setBusy(true);
    setDemoKind(kind);
    try {
      const session = await withTimeout(startDemoFn({ data: { kind } }));
      // En gammal session i webbläsaren kan hålla inloggningslåset; släpp den
      // lokalt först så att den nya sessionen inte fastnar i kö.
      await withTimeout(supabase.auth.signOut({ scope: "local" }));
      const { error } = await withTimeout(
        supabase.auth.setSession({
          access_token: session.accessToken,
          refresh_token: session.refreshToken,
        }),
      );
      if (error) throw error;
      const home = DEMO_ROLES.find((r) => r.kind === kind)?.to ?? "/app";
      // En sparad adress som bara är en startsida gäller inte vid byte av roll.
      const target = redirect && !Object.values(AREA_HOMES).includes(redirect) ? redirect : home;
      void navigate({ href: target, replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte starta demon");
    } finally {
      setBusy(false);
      setDemoKind(null);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center px-5 py-14">
        <div className="w-full max-w-sm">
          <Link to="/">
            <Logo />
          </Link>
          <h1 className="mt-10 text-2xl font-semibold tracking-tight">
            {mode === "login" ? "Logga in" : "Glömt lösenord"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === "login"
              ? "Allt som rör ditt boende – på ett ställe."
              : "Vi skickar en länk där du väljer ett nytt lösenord."}
          </p>

          {mode === "sent" ? (
            <div className="mt-8 rounded-xl border border-border p-4 text-sm">
              <p className="font-medium">Kolla din e-post</p>
              <p className="mt-1 text-muted-foreground">
                Om {email} har ett konto har vi skickat en länk för att välja nytt lösenord. Länken
                gäller i en timme.
              </p>
              <button
                type="button"
                className="mt-3 text-sm text-primary underline-offset-4 hover:underline"
                onClick={() => setMode("login")}
              >
                Tillbaka till inloggningen
              </button>
            </div>
          ) : mode === "reset" ? (
            <form onSubmit={sendReset} className="mt-8 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">E-post</Label>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                Skicka länk
              </Button>
              <button
                type="button"
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => setMode("login")}
              >
                Tillbaka till inloggningen
              </button>
            </form>
          ) : (
            <>
              {bankId?.configured ? (
                <div className="mt-8">
                  <BankIdLoginButton redirect={redirect} disabled={busy} />
                  <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    eller med e-post
                    <span className="h-px flex-1 bg-border" />
                  </div>
                </div>
              ) : null}
              <form
                onSubmit={submit}
                className={bankId?.configured ? "mt-6 space-y-4" : "mt-8 space-y-4"}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">E-post</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Lösenord</Label>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                      onClick={() => setMode("reset")}
                    >
                      Glömt lösenord?
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  variant={bankId?.configured ? "outline" : "default"}
                  className="w-full"
                  disabled={busy}
                >
                  Logga in
                </Button>
              </form>
            </>
          )}

          <p className="mt-6 text-sm text-muted-foreground">
            Konton skapas av din förening eller hyresvärd. Kontakta förvaltningen om du saknar
            inloggning.
          </p>

          <div id="demo" className="mt-10 rounded-xl border border-border bg-surface-muted p-4">
            <p className="text-sm font-medium">Testa demomiljön</p>
            <p className="mt-1 text-xs text-muted-foreground">
              BRF Solrosen med 184 lägenheter, ärenden, bokningar och ekonomi. Demon återställs
              varje natt.
            </p>
            <div className="mt-3 grid gap-2">
              {DEMO_ROLES.map((role) => (
                <Button
                  key={role.kind}
                  variant="secondary"
                  className="h-auto justify-between py-2.5"
                  disabled={busy}
                  onClick={() => demoLogin(role.kind)}
                >
                  <span className="font-medium">{role.label}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {demoKind === role.kind ? "Startar demon…" : role.description}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-primary lg:block">
        <div className="absolute inset-0 opacity-30 [background:radial-gradient(80%_60%_at_20%_10%,_oklch(0.75_0.09_249)_0%,_transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-end gap-6 p-14 text-primary-foreground">
          <p className="font-display text-4xl leading-tight">
            Ett operativsystem för fastigheten – och en digital plats för de boende.
          </p>
          <p className="max-w-md text-sm text-primary-foreground/80">
            Felanmälan, bokningar, ekonomi, dokument, möten och kommunikation i samma system, för
            bostadsrättsföreningar, hyresvärdar och förvaltare.
          </p>
        </div>
      </div>
    </div>
  );
}
