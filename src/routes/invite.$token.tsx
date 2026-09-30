import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, Home, PartyPopper } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  acceptInvitation,
  getInvitation,
  registerWithInvitation,
  type AcceptedInvitation,
  type InvitationPreview,
} from "@/lib/household.functions";
import { errorMessage } from "@/lib/errors";
import { dateLong } from "@/lib/format";
import { renderWelcome } from "@/lib/welcome";
import { Logo } from "@/components/app-shell";
import { OrgBrandMark, PoweredBy } from "@/components/org-brand";
import { isOwnBrand, useBrandTheme, type OrgBrand } from "@/lib/org-brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [{ title: "Inbjudan – Boendeplattformen" }, { name: "robots", content: "noindex" }],
  }),
  component: InvitePage,
});

/** Sidan visas i föreningens varumärke när den har ett eget. */
function Shell({
  children,
  brand,
  orgName,
}: {
  children: React.ReactNode;
  brand?: OrgBrand | null | undefined;
  orgName?: string | undefined;
}) {
  useBrandTheme(brand);
  const own = isOwnBrand(brand);
  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-lg">
        {own ? (
          <OrgBrandMark brand={brand} orgName={orgName} />
        ) : (
          <Link to="/" aria-label="Boendeplattformen – till startsidan">
            <Logo />
          </Link>
        )}
        <div className="mt-8">{children}</div>
        {own ? <PoweredBy className="mt-12" /> : null}
      </div>
    </div>
  );
}

function brandOf(invite: InvitationPreview | undefined): OrgBrand | null {
  const b = invite?.brand;
  if (!b) return null;
  return {
    mode: b.mode as OrgBrand["mode"],
    name: b.name,
    logoPath: b.logo_path,
    color: b.color,
  };
}

function InvitePage() {
  const { token } = Route.useParams();
  const previewFn = useServerFn(getInvitation);
  const { data: invite, isPending } = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => previewFn({ data: { token } }),
    retry: false,
  });
  const [session, setSession] = useState<{ email: string | undefined } | null | undefined>(
    undefined,
  );
  const [accepted, setAccepted] = useState<AcceptedInvitation | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ? { email: data.session.user.email } : null);
    });
  }, []);

  const brand = brandOf(invite);
  const orgName = invite?.organization_name;

  if (accepted) return <Welcome accepted={accepted} brand={brand} />;

  if (isPending || session === undefined) {
    return (
      <Shell brand={brand} orgName={orgName}>
        <p className="text-base text-muted-foreground" role="status">
          Hämtar inbjudan…
        </p>
      </Shell>
    );
  }

  if (!invite || invite.status !== "valid") {
    const text =
      invite?.status === "used"
        ? {
            title: "Inbjudan är redan använd",
            body: "Har du redan skapat ditt konto loggar du in som vanligt.",
          }
        : invite?.status === "expired"
          ? {
              title: "Inbjudan har gått ut",
              body: "Länken gällde i 14 dagar. Be styrelsen eller förvaltaren om en ny inbjudan.",
            }
          : invite?.status === "revoked"
            ? {
                title: "Inbjudan gäller inte längre",
                body: "Länken har återkallats. Be styrelsen eller förvaltaren om en ny inbjudan.",
              }
            : {
                title: "Vi hittar inte inbjudan",
                body: "Kontrollera att hela länken kom med när du kopierade den, eller be om en ny.",
              };
    return (
      <Shell brand={brand} orgName={orgName}>
        <h1 className="text-2xl font-semibold tracking-tight">{text.title}</h1>
        <p className="mt-3 text-base text-muted-foreground">{text.body}</p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/auth">Till inloggningen</Link>
        </Button>
      </Shell>
    );
  }

  return (
    <Shell brand={brand} orgName={orgName}>
      <p className="text-base text-muted-foreground">Du har blivit inbjuden till</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
        {invite.organization_name}
      </h1>
      <div className="mt-5 flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <Home className="size-6" aria-hidden />
        </span>
        <div>
          <p className="text-lg font-semibold">
            {invite.address}, lägenhet {invite.unit_number}
          </p>
          <p className="text-sm text-muted-foreground">
            Inbjudan gäller till och med {dateLong(invite.expires_at)}
          </p>
        </div>
      </div>

      {invite.is_demo ? (
        <p className="mt-6 rounded-xl bg-warning-soft p-4 text-sm">
          Det här är en demoförening. Så här ser en inbjudan ut för den som får den, men den kan
          inte användas för att skapa ett konto.
        </p>
      ) : null}

      {session ? (
        <AcceptAsLoggedIn
          token={token}
          email={session.email}
          defaultName={invite.invitee_name ?? ""}
          disabled={!!invite.is_demo}
          onAccepted={setAccepted}
          onSignedOut={() => setSession(null)}
        />
      ) : (
        <Register
          token={token}
          defaultName={invite.invitee_name ?? ""}
          defaultEmail={invite.invitee_email ?? ""}
          disabled={!!invite.is_demo}
          onAccepted={setAccepted}
        />
      )}
    </Shell>
  );
}

function Register({
  token,
  defaultName,
  defaultEmail,
  disabled,
  onAccepted,
}: {
  token: string;
  defaultName: string;
  defaultEmail: string;
  disabled: boolean;
  onAccepted: (a: AcceptedInvitation) => void;
}) {
  const fn = useServerFn(registerWithInvitation);
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Lösenordet behöver vara minst 8 tecken.");
      return;
    }
    setBusy(true);
    try {
      const res = await fn({ data: { token, fullName: name, email, password } });
      await supabase.auth.signOut({ scope: "local" });
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: res.accessToken,
        refresh_token: res.refreshToken,
      });
      if (sessionError) throw sessionError;
      onAccepted(res.accepted);
    } catch (err) {
      setError(errorMessage(err, "Kontot kunde inte skapas. Försök igen."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
      <div>
        <h2 className="text-lg font-semibold">Skapa ditt konto</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Du loggar sedan in med din e-post och ditt lösenord.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-name">Ditt namn</Label>
        <Input
          id="inv-name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-email">E-post</Label>
        <Input
          id="inv-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-password">Välj ett lösenord</Label>
        <div className="relative">
          <Input
            id="inv-password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            aria-describedby="inv-password-hint"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-24"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute top-1/2 right-1 flex h-9 -translate-y-1/2 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-muted"
            aria-pressed={show}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {show ? "Dölj" : "Visa"}
          </button>
        </div>
        <p id="inv-password-hint" className="text-sm text-muted-foreground">
          Minst 8 tecken.
        </p>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={disabled || busy || !name.trim() || !email.trim() || !password}
      >
        {busy ? "Skapar ditt konto…" : "Skapa konto"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Har du redan ett konto?{" "}
        <Link
          to="/auth"
          search={{ redirect: `/invite/${token}` }}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Logga in och ta emot inbjudan
        </Link>
      </p>
    </form>
  );
}

function AcceptAsLoggedIn({
  token,
  email,
  defaultName,
  disabled,
  onAccepted,
  onSignedOut,
}: {
  token: string;
  email: string | undefined;
  defaultName: string;
  disabled: boolean;
  onAccepted: (a: AcceptedInvitation) => void;
  onSignedOut: () => void;
}) {
  const fn = useServerFn(acceptInvitation);
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    try {
      onAccepted(await fn({ data: { token, fullName: defaultName } }));
    } catch (err) {
      toast.error(errorMessage(err, "Inbjudan kunde inte tas emot. Försök igen."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      <p className="text-base">
        Du är inloggad som <strong>{email}</strong>. Ta emot inbjudan för att koppla kontot till
        lägenheten.
      </p>
      <Button size="lg" className="w-full" onClick={accept} disabled={disabled || busy}>
        {busy ? "Kopplar…" : "Ta emot inbjudan"}
      </Button>
      <button
        type="button"
        className="min-h-10 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => void supabase.auth.signOut({ scope: "local" }).then(onSignedOut)}
      >
        Inte du? Logga ut och skapa ett nytt konto
      </button>
    </div>
  );
}

function Welcome({ accepted, brand }: { accepted: AcceptedInvitation; brand: OrgBrand | null }) {
  const navigate = useNavigate();
  const welcome = renderWelcome(accepted.welcome_message, {
    föreningsnamn: accepted.organization_name,
    adress: accepted.address,
    lägenhetsnummer: accepted.unit_number,
    boendes_namn: accepted.resident_name,
  });
  return (
    <Shell brand={brand} orgName={accepted.organization_name}>
      <span className="grid size-14 place-items-center rounded-2xl bg-success-soft text-success">
        <PartyPopper className="size-7" aria-hidden />
      </span>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">{welcome.title}</h1>
      <p className="mt-4 text-base whitespace-pre-line">{welcome.intro}</p>
      {welcome.custom ? (
        <p className="mt-4 rounded-xl border border-border bg-card p-4 text-base whitespace-pre-line">
          {welcome.custom}
        </p>
      ) : null}
      <Button
        size="lg"
        className="mt-8 w-full sm:w-auto"
        onClick={() => void navigate({ to: "/app", replace: true })}
      >
        Gå till startsidan
      </Button>
    </Shell>
  );
}
