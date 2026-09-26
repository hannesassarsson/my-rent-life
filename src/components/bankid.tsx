import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  createBankIdLinkTicket,
  getMemberBankId,
  getMyBankId,
  linkMemberBankId,
  unlinkMemberBankId,
  unlinkMyBankId,
} from "@/lib/bankid.functions";
import { useCan } from "@/lib/use-can";
import { DataRow, Panel } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dateLong } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Meddelanden från BankID-flödet (?bankid=... i adressen). */
export const BANKID_MESSAGES: Record<string, { text: string; ok?: boolean }> = {
  "ej-aktiverat": { text: "BankID är inte aktiverat ännu. Logga in med e-post och lösenord." },
  avbrutet: { text: "Legitimeringen avbröts." },
  ogiltig: { text: "Inloggningen hann gå ut. Försök igen." },
  "inget-konto": {
    text: "Inget konto är kopplat till ditt personnummer. Logga in med e-post en gång och koppla BankID under Min profil, eller kontakta din förening.",
  },
  "okand-legitimation": { text: "Personnumret kunde inte läsas från legitimeringen." },
  fel: { text: "Något gick fel med BankID. Försök igen om en stund." },
  kopplat: { text: "BankID är kopplat. Nästa gång kan du logga in med BankID.", ok: true },
  upptaget: { text: "Personnumret är redan kopplat till ett annat konto." },
  demo: { text: "Demokonton delas av alla och kan inte kopplas till BankID." },
};

/** Enkel symbol för BankID-knappar (inte BankID:s varumärkeslogga). */
export function BankIdMark({ className }: { className?: string }) {
  return <ShieldCheck className={cn("size-4", className)} aria-hidden />;
}

export function BankIdLoginButton({
  redirect,
  disabled,
}: {
  redirect?: string | undefined;
  disabled?: boolean;
}) {
  const href = `/api/bankid/start${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`;
  return (
    <Button asChild={!disabled} className="h-11 w-full" disabled={disabled}>
      {disabled ? (
        <span>
          <BankIdMark />
          Logga in med BankID
        </span>
      ) : (
        <a href={href}>
          <BankIdMark />
          Logga in med BankID
        </a>
      )}
    </Button>
  );
}

/** Visar och tar bort ?bankid=... efter återkomsten från BankID. */
export function useBankIdResultToast() {
  const search = useRouterState({ select: (s) => s.location.searchStr });
  useEffect(() => {
    const code = new URLSearchParams(search).get("bankid");
    const msg = code ? BANKID_MESSAGES[code] : null;
    if (!msg) return;
    if (msg.ok) toast.success(msg.text);
    else toast.error(msg.text, { duration: 8000 });
    const url = new URL(window.location.href);
    url.searchParams.delete("bankid");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [search]);
}

export function BankIdPanel() {
  const getFn = useServerFn(getMyBankId);
  const linkFn = useServerFn(createBankIdLinkTicket);
  const unlinkFn = useServerFn(unlinkMyBankId);
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data } = useQuery({ queryKey: ["my-bankid"], queryFn: () => getFn() });
  useBankIdResultToast();

  const link = useMutation({
    mutationFn: () => linkFn({ data: { back: pathname } }),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unlink = useMutation({
    mutationFn: () => unlinkFn(),
    onSuccess: () => {
      toast.success("BankID-kopplingen är borttagen");
      void qc.invalidateQueries({ queryKey: ["my-bankid"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel
      title="BankID"
      description="Logga in med BankID i stället för lösenord."
      action={
        data?.linked ? (
          <StatusPill tone="success">Kopplat</StatusPill>
        ) : data ? (
          <StatusPill tone="neutral">Inte kopplat</StatusPill>
        ) : null
      }
    >
      {!data ? (
        <p className="text-sm text-muted-foreground">Hämtar…</p>
      ) : data.linked ? (
        <div>
          <dl>
            <DataRow label="Personnummer" value={data.hint ?? "—"} />
            <DataRow label="Kopplat" value={data.linked_at ? dateLong(data.linked_at) : "—"} />
            <DataRow
              label="Senaste inloggning"
              value={data.last_login_at ? dateLong(data.last_login_at) : "Aldrig"}
            />
          </dl>
          <Button
            variant="ghost"
            className="mt-3 text-muted-foreground"
            disabled={unlink.isPending}
            onClick={() => unlink.mutate()}
          >
            Ta bort kopplingen
          </Button>
        </div>
      ) : data.configured ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Legitimera dig en gång med BankID så kopplas det till ditt konto. Vi sparar aldrig
            själva personnumret, bara en kontrollsumma som inte går att räkna tillbaka.
          </p>
          <Button disabled={link.isPending} onClick={() => link.mutate()}>
            <BankIdMark />
            {link.isPending ? "Öppnar BankID…" : "Koppla BankID"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          BankID är inte aktiverat ännu. När det är på plats kopplar du det här.
        </p>
      )}
    </Panel>
  );
}

/** Förvaltningens vy av en boendes BankID, med möjlighet att ange personnumret. */
export function MemberBankId({ userId }: { userId: string }) {
  const getFn = useServerFn(getMemberBankId);
  const linkFn = useServerFn(linkMemberBankId);
  const unlinkFn = useServerFn(unlinkMemberBankId);
  const can = useCan();
  const qc = useQueryClient();
  const [pnr, setPnr] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["member-bankid", userId],
    queryFn: () => getFn({ data: { userId } }),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["member-bankid", userId] });

  const link = useMutation({
    mutationFn: (personnummer: string) => linkFn({ data: { userId, personnummer } }),
    onSuccess: () => {
      toast.success("BankID är kopplat. Den boende kan logga in med BankID direkt.");
      setPnr(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unlink = useMutation({
    mutationFn: () => unlinkFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("BankID-kopplingen är borttagen");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return null;
  const canEdit = can("residents.edit") && data.configured;

  return (
    <div className="border-t border-border/70 pt-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground">BankID</span>
        <span className="text-right text-sm font-medium">
          {data.linked ? `Kopplat · ${data.hint}` : "Inte kopplat"}
        </span>
      </div>
      {data.linked && data.lastLoginAt ? (
        <p className="mt-1 text-right text-xs text-muted-foreground">
          Senast inloggad {dateLong(data.lastLoginAt)}
        </p>
      ) : null}
      {canEdit ? (
        pnr === null ? (
          <div className="mt-2 flex justify-end gap-2">
            {data.linked ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={unlink.isPending}
                onClick={() => unlink.mutate()}
              >
                Ta bort
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => setPnr("")}>
              {data.linked ? "Byt personnummer" : "Ange personnummer"}
            </Button>
          </div>
        ) : (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              link.mutate(pnr);
            }}
          >
            <Input
              autoFocus
              inputMode="numeric"
              placeholder="ÅÅÅÅMMDD-NNNN"
              aria-label="Personnummer"
              value={pnr}
              onChange={(e) => setPnr(e.target.value)}
            />
            <Button type="submit" size="sm" className="h-9" disabled={link.isPending || !pnr}>
              Koppla
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9"
              onClick={() => setPnr(null)}
            >
              Avbryt
            </Button>
          </form>
        )
      ) : null}
    </div>
  );
}
