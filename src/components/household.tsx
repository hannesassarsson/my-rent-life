import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Mail } from "lucide-react";
import { toast } from "sonner";

import { addResident, createInvitation } from "@/lib/household.functions";
import { errorMessage } from "@/lib/errors";
import { dateLong, toDateInput } from "@/lib/format";
import { StatusPill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ------------------------------ STATUS ------------------------------ */

export function AccountStatusPill({
  status,
  userId,
  invited,
}: {
  status: string;
  userId: string | null;
  invited?: boolean;
}) {
  if (status !== "active") return <StatusPill tone="neutral">Utflyttad</StatusPill>;
  if (userId) return <StatusPill tone="success">Har konto</StatusPill>;
  if (invited) return <StatusPill tone="info">Inbjuden</StatusPill>;
  return <StatusPill tone="warning">Inget konto</StatusPill>;
}

export function HouseholdRolePill({ primary }: { primary: boolean }) {
  return (
    <StatusPill tone={primary ? "info" : "neutral"}>
      {primary ? "Primär boende" : "Hushållsmedlem"}
    </StatusPill>
  );
}

function invalidateHousehold(qc: ReturnType<typeof useQueryClient>) {
  for (const key of [
    "admin-residents",
    "admin-units",
    "unit-detail",
    "unit-registry",
    "audit-log",
  ]) {
    void qc.invalidateQueries({ queryKey: [key] });
  }
}

/* ---------------------------- LÄGG TILL ---------------------------- */

type UnitOption = { id: string; unit_number: string; address: string; tenure: "owned" | "rented" };

/**
 * Lägg till en boende. Med `unit` gäller det en bestämd lägenhet (från
 * lägenhetssidan); annars väljer man lägenhet i en lista.
 */
export function AddResidentDialog({
  open,
  onOpenChange,
  unit,
  units,
  unitHasResidents,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit?: UnitOption;
  units?: UnitOption[];
  /** Om lägenheten redan har boende föreslås "hushållsmedlem". */
  unitHasResidents?: (unitId: string) => boolean;
  onAdded?: (id: string) => void;
}) {
  const fn = useServerFn(addResident);
  const qc = useQueryClient();
  const firstUnit = unit ?? units?.[0];
  const [unitId, setUnitId] = useState(firstUnit?.id ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [moveInDate, setMoveInDate] = useState(toDateInput(new Date()));
  const [primaryChoice, setPrimaryChoice] = useState<boolean | null>(null);

  const selected = unit ?? units?.find((u) => u.id === unitId);
  const occupied = selected ? (unitHasResidents?.(selected.id) ?? false) : false;
  const isPrimary = primaryChoice ?? !occupied;

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setPrimaryChoice(null);
    setMoveInDate(toDateInput(new Date()));
  };

  const save = useMutation({
    mutationFn: () =>
      fn({
        data: {
          unitId: selected!.id,
          residentName: name,
          email,
          phone,
          tenure: selected!.tenure,
          moveInDate,
          isPrimary,
        },
      }),
    onSuccess: (res) => {
      toast.success(`${name} är tillagd i lägenhet ${selected?.unit_number}`);
      invalidateHousehold(qc);
      reset();
      onOpenChange(false);
      onAdded?.(res.id);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lägg till boende</DialogTitle>
          <DialogDescription>
            {unit
              ? `${unit.address}, lägenhet ${unit.unit_number}`
              : "Välj lägenhet och fyll i personens uppgifter. Du kan skicka en inbjudan efteråt."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (selected && name.trim()) save.mutate();
          }}
        >
          {!unit && units ? (
            <div className="space-y-2">
              <Label htmlFor="add-unit">Lägenhet</Label>
              <Select
                value={unitId}
                onValueChange={(v) => {
                  setUnitId(v);
                  setPrimaryChoice(null);
                }}
              >
                <SelectTrigger id="add-unit">
                  <SelectValue placeholder="Välj lägenhet" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.address} · lägenhet {u.unit_number}
                      {unitHasResidents?.(u.id) ? "" : " (ledig)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="add-name">Namn</Label>
            <Input
              id="add-name"
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="add-email">
                E-post <span className="font-normal text-muted-foreground">(för inbjudan)</span>
              </Label>
              <Input
                id="add-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-phone">
                Telefon <span className="font-normal text-muted-foreground">(valfritt)</span>
              </Label>
              <Input
                id="add-phone"
                type="tel"
                autoComplete="off"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-date">Inflyttningsdatum</Label>
            <Input
              id="add-date"
              type="date"
              value={moveInDate}
              onChange={(e) => setMoveInDate(e.target.value)}
              required
            />
          </div>
          {occupied ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Roll i hushållet</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: false, title: "Hushållsmedlem", hint: "T.ex. sambo eller barn" },
                  { value: true, title: "Primär boende", hint: "Ersätter nuvarande primär" },
                ].map((o) => (
                  <label
                    key={String(o.value)}
                    className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                      isPrimary === o.value ? "border-primary bg-accent" : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="household-role"
                      className="mt-1 size-4 accent-[var(--primary)]"
                      checked={isPrimary === o.value}
                      onChange={() => setPrimaryChoice(o.value)}
                    />
                    <span>
                      <span className="block text-sm font-medium">{o.title}</span>
                      <span className="block text-xs text-muted-foreground">{o.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
              Lägenheten har inga boende, så personen blir primär boende.
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={!selected || !name.trim() || save.isPending}
          >
            {save.isPending ? "Sparar…" : "Lägg till boende"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- INBJUDAN ----------------------------- */

type InviteResult = Awaited<ReturnType<typeof createInvitation>>;

/**
 * Skapar en inbjudningslänk till en lägenhet, antingen för en boende som
 * redan finns i hushållet eller för en ny person.
 */
export function InviteDialog({
  open,
  onOpenChange,
  unit,
  residency,
  emailAvailable,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: { id: string; unit_number: string; address: string };
  residency?: { id: string; resident_name: string; email: string | null } | null;
  emailAvailable: boolean;
}) {
  const fn = useServerFn(createInvitation);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [result, setResult] = useState<InviteResult | null>(null);

  const targetEmail = residency ? email || residency.email || "" : email;
  const canEmail = emailAvailable && !!targetEmail;

  const create = useMutation({
    mutationFn: () =>
      fn({
        data: {
          unitId: unit.id,
          ...(residency ? { residencyId: residency.id } : {}),
          name: residency ? "" : name,
          email: residency ? email : email,
          sendEmail: canEmail && sendEmail,
        },
      }),
    onSuccess: (res) => {
      setResult(res);
      invalidateHousehold(qc);
      if (res.emailed) toast.success(`Inbjudan är skickad till ${targetEmail}`);
      else if (res.emailError) toast.error(res.emailError);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const close = (v: boolean) => {
    if (!v) {
      setResult(null);
      setName("");
      setEmail("");
      setSendEmail(true);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{result ? "Inbjudan är skapad" : "Bjud in till lägenheten"}</DialogTitle>
          <DialogDescription>
            {unit.address}, lägenhet {unit.unit_number}
            {residency ? ` · ${residency.resident_name}` : ""}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            {result.emailed ? (
              <p className="flex items-start gap-2 rounded-lg bg-success-soft p-3 text-sm text-success">
                <Mail className="mt-0.5 size-4 shrink-0" /> Inbjudan är skickad till {targetEmail}.
              </p>
            ) : null}
            <CopyLink link={result.link} />
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>
                Länken gäller till och med {dateLong(result.expiresAt)} och kan användas en gång.
              </li>
              <li>
                Av säkerhetsskäl visas länken bara nu. Behöver du den igen skapar du en ny; den
                gamla slutar då att gälla.
              </li>
            </ul>
            <Button className="w-full" variant="outline" onClick={() => close(false)}>
              Klar
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <p className="text-sm text-muted-foreground">
              Personen får en länk och skapar sitt konto själv. Kontot kopplas automatiskt till den
              här lägenheten.
            </p>
            {residency ? null : (
              <div className="space-y-2">
                <Label htmlFor="invite-name">
                  Namn <span className="font-normal text-muted-foreground">(valfritt)</span>
                </Label>
                <Input
                  id="invite-name"
                  autoComplete="off"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="invite-email">E-post</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                placeholder={residency?.email ?? "namn@exempel.se"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {residency?.email && !email ? (
                <p className="text-xs text-muted-foreground">
                  Lämna tomt för att använda {residency.email}.
                </p>
              ) : null}
            </div>
            {emailAvailable ? (
              <label className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={sendEmail && !!targetEmail}
                  disabled={!targetEmail}
                  onCheckedChange={(v) => setSendEmail(v === true)}
                />
                Skicka länken med e-post
              </label>
            ) : null}
            <Button type="submit" className="w-full" disabled={create.isPending}>
              {create.isPending
                ? "Skapar…"
                : canEmail && sendEmail
                  ? "Skapa och skicka inbjudan"
                  : "Skapa inbjudningslänk"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor="invite-link">Inbjudningslänk</Label>
      <div className="flex gap-2">
        <Input
          id="invite-link"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono text-xs"
        />
        <Button
          type="button"
          onClick={() => {
            void navigator.clipboard
              .writeText(link)
              .then(() => {
                setCopied(true);
                toast.success("Länken är kopierad");
                setTimeout(() => setCopied(false), 2500);
              })
              .catch(() =>
                toast.error("Kunde inte kopiera. Markera länken och kopiera den själv."),
              );
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Kopierad" : "Kopiera"}
        </Button>
      </div>
    </div>
  );
}
