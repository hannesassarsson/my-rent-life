import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { getAdminSettings, updateOrganization, updateWelcomeMessage } from "@/lib/app.functions";
import { errorMessage } from "@/lib/errors";
import { WELCOME_EXAMPLE, WELCOME_VARIABLES, renderWelcome, type WelcomeVars } from "@/lib/welcome";
import { LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { BrandingEditor } from "@/components/branding-editor";
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

export const Route = createFileRoute("/_authenticated/admin/forening")({
  head: () => ({ meta: [{ title: "Föreningsinställningar – Boendeplattformen" }] }),
  component: OrganizationSettings,
});

type OrgType = "brf" | "rental" | "manager";

const orgTypeLabels: Record<OrgType, string> = {
  brf: "Bostadsrättsförening",
  rental: "Hyresfastigheter",
  manager: "Förvaltare",
};

type OrgForm = {
  name: string;
  orgType: OrgType;
  contactEmail: string;
  contactPhone: string;
  emergencyPhone: string;
  address: string;
  about: string;
};

function OrganizationSettings() {
  const fn = useServerFn(getAdminSettings);
  const { data, isPending } = useQuery({ queryKey: ["admin-settings"], queryFn: () => fn() });

  return (
    <div>
      <PageHeader
        title="Föreningsinställningar"
        subtitle="Uppgifter som de boende ser: namn, kontaktvägar, välkomstmeddelandet och ert varumärke."
      />
      {isPending || !data?.organization ? (
        <LoadingBlock rows={5} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <OrganizationForm org={data.organization} />
          <WelcomeEditor
            orgName={data.organization.name}
            initial={data.organization.welcome_message ?? ""}
          />
          <BrandingEditor org={data.organization} />
        </div>
      )}
    </div>
  );
}

function OrganizationForm({
  org,
}: {
  org: NonNullable<Awaited<ReturnType<typeof getAdminSettings>>["organization"]>;
}) {
  const saveFn = useServerFn(updateOrganization);
  const qc = useQueryClient();
  const initial: OrgForm = {
    name: org.name,
    orgType: (org.org_type as OrgType) ?? "brf",
    contactEmail: org.contact_email ?? "",
    contactPhone: org.contact_phone ?? "",
    emergencyPhone: org.emergency_phone ?? "",
    address: org.address ?? "",
    about: org.about ?? "",
  };
  const [form, setForm] = useState<OrgForm>(initial);
  const set = (patch: Partial<OrgForm>) => setForm((f) => ({ ...f, ...patch }));
  const changed = JSON.stringify(form) !== JSON.stringify(initial);

  const save = useMutation({
    mutationFn: () => saveFn({ data: form }),
    onSuccess: () => {
      toast.success("Föreningens uppgifter är sparade");
      void qc.invalidateQueries({ queryKey: ["admin-settings"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Panel title="Om föreningen" description="Visas för de boende under Mitt boende och i Hjälp">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="org-name">Föreningens namn</Label>
            <Input
              id="org-name"
              required
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-type">Typ</Label>
            <Select value={form.orgType} onValueChange={(v) => set({ orgType: v as OrgType })}>
              <SelectTrigger id="org-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(orgTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-address">Adress</Label>
          <Input
            id="org-address"
            placeholder="T.ex. Solbackevägen 4, 123 45 Stockholm"
            value={form.address}
            onChange={(e) => set({ address: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="org-email">Kontakt-e-post</Label>
            <Input
              id="org-email"
              type="email"
              placeholder="styrelsen@exempel.se"
              value={form.contactEmail}
              onChange={(e) => set({ contactEmail: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-phone">Telefon</Label>
            <Input
              id="org-phone"
              type="tel"
              value={form.contactPhone}
              onChange={(e) => set({ contactPhone: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-emergency">Journummer</Label>
          <Input
            id="org-emergency"
            type="tel"
            aria-describedby="org-emergency-hint"
            value={form.emergencyPhone}
            onChange={(e) => set({ emergencyPhone: e.target.value })}
          />
          <p id="org-emergency-hint" className="text-sm text-muted-foreground">
            Visas för akuta fel som vattenläcka eller strömavbrott utanför kontorstid.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-about">Information om föreningen</Label>
          <Textarea
            id="org-about"
            rows={4}
            placeholder="Kort om föreningen, t.ex. när styrelsen har mottagning."
            value={form.about}
            onChange={(e) => set({ about: e.target.value })}
          />
        </div>
        <Button type="submit" disabled={!changed || !form.name.trim() || save.isPending}>
          {save.isPending ? "Sparar…" : "Spara ändringar"}
        </Button>
      </form>
    </Panel>
  );
}

const PREVIEW_VARS: WelcomeVars = {
  föreningsnamn: "",
  adress: "Storgatan 12",
  lägenhetsnummer: "1001",
  boendes_namn: "Anna Andersson",
};

function WelcomeEditor({ orgName, initial }: { orgName: string; initial: string }) {
  const saveFn = useServerFn(updateWelcomeMessage);
  const qc = useQueryClient();
  const [message, setMessage] = useState(initial);
  useEffect(() => setMessage(initial), [initial]);
  const preview = renderWelcome(message, { ...PREVIEW_VARS, föreningsnamn: orgName });

  const save = useMutation({
    mutationFn: () => saveFn({ data: { message } }),
    onSuccess: () => {
      toast.success("Välkomstmeddelandet är sparat");
      void qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const insert = (key: string) =>
    setMessage((m) => `${m}${m && !m.endsWith(" ") ? " " : ""}{${key}}`);

  return (
    <Panel
      title="Välkomstmeddelande"
      description="Visas för en ny boende direkt efter att kontot skapats"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="welcome">Er egen hälsning</Label>
          <Textarea
            id="welcome"
            rows={5}
            placeholder={WELCOME_EXAMPLE}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            aria-describedby="welcome-hint"
          />
          <p id="welcome-hint" className="text-sm text-muted-foreground">
            Läggs till efter standardtexten. Tryck på en variabel för att lägga in den; den byts ut
            mot rätt uppgift för varje boende.
          </p>
          <div className="flex flex-wrap gap-2">
            {WELCOME_VARIABLES.map((v) => (
              <Button
                key={v.key}
                type="button"
                size="sm"
                variant="outline"
                title={v.description}
                onClick={() => insert(v.key)}
              >
                {`{${v.key}}`}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Förhandsvisning</p>
          <div className="rounded-xl border border-border bg-surface-muted p-5">
            <p className="text-lg font-semibold">{preview.title}</p>
            <p className="mt-3 text-sm whitespace-pre-line">{preview.intro}</p>
            {preview.custom ? (
              <p className="mt-3 rounded-lg bg-card p-3 text-sm whitespace-pre-line">
                {preview.custom}
              </p>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Exemplet visar en påhittad boende, Anna Andersson i lägenhet 1001.
          </p>
        </div>

        <Button onClick={() => save.mutate()} disabled={message === initial || save.isPending}>
          {save.isPending ? "Sparar…" : "Spara välkomstmeddelandet"}
        </Button>
      </div>
    </Panel>
  );
}
