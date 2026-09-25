import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/app-shell";
import { startDemo, type DemoKind } from "@/lib/public.functions";

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

export const Route = createFileRoute("/auth")({
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const startDemoFn = useServerFn(startDemo);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/app", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Något gick fel");
    } finally {
      setBusy(false);
    }
  }

  async function demoLogin(kind: DemoKind) {
    setBusy(true);
    try {
      const session = await startDemoFn({ data: { kind } });
      const { error } = await supabase.auth.setSession({
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
      });
      if (error) throw error;
      navigate({ to: DEMO_ROLES.find((r) => r.kind === kind)?.to ?? "/app", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte starta demon");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center px-5 py-14">
        <div className="w-full max-w-sm">
          <Link to="/">
            <Logo />
          </Link>
          <h1 className="mt-10 text-2xl font-semibold tracking-tight">Logga in</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Allt som rör ditt boende – på ett ställe.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
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
              <Label htmlFor="password">Lösenord</Label>
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
            <Button type="submit" className="w-full" disabled={busy}>
              Logga in
            </Button>
          </form>

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
                    {role.description}
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
