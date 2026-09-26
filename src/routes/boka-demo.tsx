import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { requestDemo } from "@/lib/public.functions";
import { Logo } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/boka-demo")({
  head: () => ({
    meta: [
      { title: "Boka demo – Boendeplattformen" },
      {
        name: "description",
        content:
          "Boka en genomgång av Boendeplattformen för din bostadsrättsförening, ditt fastighetsbolag eller din förvaltning.",
      },
      { property: "og:title", content: "Boka demo – Boendeplattformen" },
    ],
  }),
  component: BookDemoPage,
});

type OrgType = "brf" | "landlord" | "manager" | "other";

const orgTypes: { value: OrgType; label: string }[] = [
  { value: "brf", label: "Bostadsrättsförening" },
  { value: "landlord", label: "Hyresvärd / fastighetsägare" },
  { value: "manager", label: "Förvaltare" },
  { value: "other", label: "Annat" },
];

function BookDemoPage() {
  const send = useServerFn(requestDemo);
  const [form, setForm] = useState({
    name: "",
    email: "",
    organization: "",
    orgType: "landlord" as OrgType,
    unitCount: "",
    message: "",
    website: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      send({
        data: {
          name: form.name,
          email: form.email,
          organization: form.organization,
          orgType: form.orgType,
          ...(form.unitCount ? { unitCount: Number(form.unitCount) } : {}),
          ...(form.message.trim() ? { message: form.message } : {}),
          ...(form.website ? { website: form.website } : {}),
        },
      }),
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (key: keyof typeof form) => (value: string) => setForm({ ...form, [key]: value });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/">
          <Logo />
        </Link>
        <Button variant="ghost" asChild>
          <Link to="/auth">Logga in</Link>
        </Button>
      </div>

      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-10 lg:grid-cols-2 lg:py-16">
        <div>
          <h1 className="font-display text-4xl leading-tight">Boka en demo</h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            Berätta lite om er så hör vi av oss inom en arbetsdag och visar hur ni kommer igång –
            från felanmälan och bokningar till avgifter, hyror och kommunikation med de boende.
          </p>
          <p className="mt-6 max-w-md text-sm text-muted-foreground">
            Vill du se systemet direkt?{" "}
            <Link
              to="/auth"
              hash="demo"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Öppna demomiljön
            </Link>{" "}
            och logga in som boende eller förvaltare.
          </p>
        </div>

        <div className="card-surface p-6">
          {mutation.isSuccess ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">Tack!</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Vi har tagit emot din förfrågan och återkommer till {form.email}.
              </p>
              <Button variant="secondary" className="mt-6" asChild>
                <Link to="/auth" hash="demo">
                  Utforska demomiljön under tiden
                </Link>
              </Button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Namn</Label>
                  <Input
                    id="name"
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => set("name")(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-post</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => set("email")(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="organization">Förening eller företag</Label>
                <Input
                  id="organization"
                  required
                  autoComplete="organization"
                  value={form.organization}
                  onChange={(e) => set("organization")(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Typ av organisation</Label>
                  <Select value={form.orgType} onValueChange={set("orgType")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {orgTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unitCount">Antal lägenheter</Label>
                  <Input
                    id="unitCount"
                    type="number"
                    min={1}
                    max={100000}
                    inputMode="numeric"
                    value={form.unitCount}
                    onChange={(e) => set("unitCount")(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Meddelande (valfritt)</Label>
                <Textarea
                  id="message"
                  rows={4}
                  maxLength={4000}
                  value={form.message}
                  onChange={(e) => set("message")(e.target.value)}
                />
              </div>
              {/* Dolt fält mot spam; lämnas tomt av människor. */}
              <div className="hidden" aria-hidden="true">
                <Label htmlFor="website">Webbplats</Label>
                <Input
                  id="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => set("website")(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {mutation.isPending ? "Skickar…" : "Skicka förfrågan"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
