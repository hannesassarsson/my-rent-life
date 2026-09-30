import { Link } from "@tanstack/react-router";
import { Mail, Phone, Siren, Users } from "lucide-react";

import { Panel } from "@/components/ui-kit";

type Org = {
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  emergency_phone: string | null;
  address: string | null;
  about: string | null;
};

/** Föreningens kontaktvägar: jour, telefon, e-post och meddelanden i appen. */
export function ContactPanel({
  org,
  className,
}: {
  org: Org | null;
  className?: string | undefined;
}) {
  if (!org) return null;
  const hasContact = org.contact_email || org.contact_phone || org.emergency_phone;
  return (
    <Panel title="Kontakta föreningen" description={org.name} {...(className ? { className } : {})}>
      <div className="space-y-3">
        {org.emergency_phone ? (
          <a
            href={`tel:${org.emergency_phone.replace(/[^\d+]/g, "")}`}
            className="flex min-h-14 items-center gap-3 rounded-xl border border-danger/30 bg-danger-soft p-3"
          >
            <Siren className="size-5 shrink-0 text-danger" aria-hidden />
            <span>
              <span className="block text-sm font-medium">Jour vid akuta fel</span>
              <span className="block text-base font-semibold">{org.emergency_phone}</span>
            </span>
          </a>
        ) : null}
        {org.contact_phone ? (
          <a
            href={`tel:${org.contact_phone.replace(/[^\d+]/g, "")}`}
            className="flex min-h-12 items-center gap-3 rounded-xl border border-border p-3"
          >
            <Phone className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="text-base">{org.contact_phone}</span>
          </a>
        ) : null}
        {org.contact_email ? (
          <a
            href={`mailto:${org.contact_email}`}
            className="flex min-h-12 items-center gap-3 rounded-xl border border-border p-3 break-all"
          >
            <Mail className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="text-base">{org.contact_email}</span>
          </a>
        ) : null}
        <Link
          to="/app/meddelanden"
          className="flex min-h-12 items-center gap-3 rounded-xl border border-border p-3"
        >
          <Users className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="text-base">Skriv ett meddelande i appen</span>
        </Link>
        {!hasContact ? (
          <p className="text-sm text-muted-foreground">
            Föreningen har inte lagt in telefon eller e-post ännu. Skriv ett meddelande så svarar de
            här.
          </p>
        ) : null}
        {org.about ? (
          <p className="border-t border-border pt-3 text-sm whitespace-pre-line text-muted-foreground">
            {org.about}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
