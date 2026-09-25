import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/aterstall")({
  ssr: false,
  head: () => ({ meta: [{ title: "Nytt lösenord – Boendeplattformen" }] }),
  component: ResetPasswordPage,
});

/**
 * Hit leder länken i återställningsmejlet. Supabase-klienten läser in
 * sessionen från länken; därefter väljer användaren ett nytt lösenord.
 */
function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    // Om länken redan lästs in (eller saknas) avgör sessionen.
    const timer = setTimeout(async () => {
      const { data: s } = await supabase.auth.getSession();
      setReady((r) => r ?? !!s.session);
    }, 1500);
    return () => {
      clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== repeat) {
      toast.error("Lösenorden är inte lika");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(
        error.message.includes("different")
          ? "Välj ett lösenord som skiljer sig från det gamla"
          : "Lösenordet kunde inte sparas",
      );
      return;
    }
    toast.success("Ditt nya lösenord är sparat");
    void navigate({ to: "/app", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-14">
      <div className="w-full max-w-sm">
        <Link to="/">
          <Logo />
        </Link>
        <h1 className="mt-10 text-2xl font-semibold tracking-tight">Välj nytt lösenord</h1>

        {ready === null ? (
          <p className="mt-4 text-sm text-muted-foreground">Kontrollerar länken…</p>
        ) : ready ? (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nytt lösenord</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Minst 8 tecken.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="repeat-password">Upprepa lösenordet</Label>
              <Input
                id="repeat-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sparar…" : "Spara lösenord"}
            </Button>
          </form>
        ) : (
          <div className="mt-6 space-y-3 text-sm">
            <p className="text-muted-foreground">
              Länken är ogiltig eller har gått ut. Begär en ny länk från inloggningssidan.
            </p>
            <Button asChild variant="outline">
              <Link to="/auth">Till inloggningen</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
