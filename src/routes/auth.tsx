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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

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
