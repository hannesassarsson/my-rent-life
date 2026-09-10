import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/app-shell";

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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  async function afterAuth() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    navigate({ to: "/app", replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await afterAuth();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Något gick fel");
    } finally {
      setBusy(false);
    }
  }

  async function demoLogin(kind: "resident" | "admin") {
    setBusy(true);
    const creds =
      kind === "admin"
        ? { email: "demo.admin@boendeplattformen.se", password: "Demo!2026Admin" }
        : { email: "demo.boende@boendeplattformen.se", password: "Demo!2026Boende" };
    try {
      const signIn = await supabase.auth.signInWithPassword(creds);
      if (signIn.error) {
        const { error } = await supabase.auth.signUp({
          ...creds,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: kind === "admin" ? "Anna Förvaltare" : "Hannes Assarsson",
              demo_role: kind === "admin" ? "admin" : "resident",
            },
          },
        });
        if (error) throw error;
        const retry = await supabase.auth.signInWithPassword(creds);
        if (retry.error) throw retry.error;
      }
      navigate({ to: kind === "admin" ? "/admin" : "/app", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte logga in");
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
          <h1 className="mt-10 text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Logga in" : "Skapa konto"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Allt som rör ditt boende – på ett ställe.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" ? (
              <div className="space-y-2">
                <Label htmlFor="name">Namn</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            ) : null}
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
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "signin" ? "Logga in" : "Skapa konto"}
            </Button>
          </form>

          <button
            className="mt-4 text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Har du inget konto? Skapa ett" : "Har du redan ett konto? Logga in"}
          </button>

          <div className="mt-10 rounded-xl border border-border bg-surface-muted p-4">
            <p className="text-sm font-medium">Testa direkt med demodata</p>
            <p className="mt-1 text-xs text-muted-foreground">
              BRF Solrosen med 184 lägenheter, ärenden, bokningar och ekonomi.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => demoLogin("resident")}>
                Som boende
              </Button>
              <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => demoLogin("admin")}>
                Som administratör
              </Button>
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
