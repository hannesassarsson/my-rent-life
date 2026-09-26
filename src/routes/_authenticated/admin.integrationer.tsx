import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileDown, Landmark, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  applyBankFile,
  exportSie,
  getIntegrations,
  getSampleBankFile,
  previewBankFile,
  saveBankDetails,
  type BankMatch,
} from "@/lib/integrations.functions";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { kr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/integrationer")({
  head: () => ({ meta: [{ title: "Integrationer – Boendeplattformen" }] }),
  component: IntegrationsPage,
});

const outcomeLabels: Record<
  BankMatch["outcome"],
  { label: string; tone: "success" | "neutral" | "warning" | "danger" }
> = {
  pay: { label: "Registreras", tone: "success" },
  already: { label: "Redan betald", tone: "neutral" },
  amount: { label: "Fel belopp", tone: "warning" },
  unknown: { label: "Okänd referens", tone: "danger" },
};

const BANKS = [
  { name: "Alla banker via Bankgirot", how: "BgMax-fil", status: "live" },
  { name: "SEB", how: "camt.054", status: "live" },
  { name: "Swedbank och sparbankerna", how: "camt.054", status: "live" },
  { name: "Handelsbanken", how: "camt.054", status: "live" },
  { name: "Nordea", how: "camt.054", status: "live" },
  { name: "Danske Bank", how: "camt.054", status: "live" },
  { name: "Länsförsäkringar Bank", how: "camt.054", status: "live" },
  { name: "ICA Banken", how: "BgMax via Bankgirot", status: "live" },
] as const;

const ACCOUNTING = [
  { name: "Fortnox", how: "SIE 4-fil", next: "Direktkoppling via API planeras" },
  { name: "Visma eEkonomi", how: "SIE 4-fil", next: "Direktkoppling via API planeras" },
  { name: "Visma Administration", how: "SIE 4-fil", next: null },
  { name: "Björn Lundén", how: "SIE 4-fil", next: null },
  { name: "Speedledger och övriga", how: "SIE 4-fil", next: null },
] as const;

function download(fileName: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function IntegrationsPage() {
  const fn = useServerFn(getIntegrations);
  const previewFn = useServerFn(previewBankFile);
  const applyFn = useServerFn(applyBankFile);
  const sampleFn = useServerFn(getSampleBankFile);
  const sieFn = useServerFn(exportSie);
  const saveFn = useServerFn(saveBankDetails);
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["integrations"], queryFn: () => fn() });
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [bank, setBank] = useState<{ bankgiro: string; orgNumber: string } | null>(null);

  useEffect(() => {
    if (data && !range && data.periods.length > 0) {
      setRange({ from: data.periods[data.periods.length - 1]!, to: data.periods[0]! });
    }
  }, [data, range]);

  const preview = useMutation({
    mutationFn: (content: string) => previewFn({ data: { content } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const apply = useMutation({
    mutationFn: (content: string) => applyFn({ data: { content } }),
    onSuccess: (r) => {
      toast.success(`${r.registered} betalningar registrerade`, {
        description: r.skipped ? `${r.skipped} rader behöver kontrolleras manuellt.` : undefined,
      });
      setFile(null);
      preview.reset();
      void qc.invalidateQueries({ queryKey: ["integrations"] });
      void qc.invalidateQueries({ queryKey: ["admin-economy"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sample = useMutation({
    mutationFn: () => sampleFn(),
    onSuccess: (r) => {
      download(r.fileName, r.content, "text/plain");
      toast.success("Exempelfilen är nedladdad", {
        description: "Läs in den nedan för att se hur importen fungerar.",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sie = useMutation({
    mutationFn: (r: { from: string; to: string }) => sieFn({ data: r }),
    onSuccess: (r) => {
      const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      download(r.fileName, bytes, "text/plain");
      toast.success(`SIE-filen är nedladdad (${r.vouchers} verifikationer)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: (b: { bankgiro: string; orgNumber: string }) => saveFn({ data: b }),
    onSuccess: () => {
      setBank(null);
      toast.success("Bankuppgifterna är sparade");
      void qc.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 5_000_000) {
      toast.error("Filen är för stor (max 5 MB).");
      return;
    }
    // BgMax är Latin-1; siffrorna läses likadant oavsett teckenkodning.
    const content = await f.text();
    setFile({ name: f.name, content });
    preview.mutate(content);
  }

  if (isPending || !data) return <LoadingBlock rows={4} />;

  const matches = preview.data?.matches ?? [];
  const toPay = matches.filter((m) => m.outcome === "pay");
  const payTotal = toPay.reduce((s, m) => s + m.amount, 0);

  return (
    <div>
      <PageHeader
        title="Integrationer"
        subtitle="Bankens inbetalningar in, bokföringen ut – med alla svenska banker och bokföringsprogram"
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="Bankuppgifter"
          description="Står på avierna tillsammans med varje avis OCR-nummer"
        >
          {bank ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="bankgiro">Bankgiro</Label>
                <Input
                  id="bankgiro"
                  value={bank.bankgiro}
                  placeholder="1234-5678"
                  onChange={(e) => setBank({ ...bank, bankgiro: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgnr">Organisationsnummer</Label>
                <Input
                  id="orgnr"
                  value={bank.orgNumber}
                  placeholder="769600-1234"
                  onChange={(e) => setBank({ ...bank, orgNumber: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button disabled={save.isPending} onClick={() => save.mutate(bank)}>
                  Spara
                </Button>
                <Button variant="ghost" onClick={() => setBank(null)}>
                  Avbryt
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2">
                <Landmark className="size-4 text-primary" />
                Bankgiro{" "}
                <span className="font-medium tnum">{data.organization?.bankgiro ?? "–"}</span>
              </p>
              <p className="text-muted-foreground">Org.nr {data.organization?.org_number ?? "–"}</p>
              {data.canEditOrganization ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setBank({
                      bankgiro: data.organization?.bankgiro ?? "",
                      orgNumber: data.organization?.org_number ?? "",
                    })
                  }
                >
                  Ändra
                </Button>
              ) : null}
            </div>
          )}
        </Panel>

        <Panel
          title="Importera inbetalningar"
          description="Från bankens fil – betalningarna matchas mot avierna via OCR-numret"
          className="lg:col-span-2"
        >
          <input
            ref={fileInput}
            type="file"
            accept=".txt,.xml,.dat,text/plain,application/xml,text/xml"
            className="hidden"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => fileInput.current?.click()} disabled={preview.isPending}>
              <Upload className="size-4" />{" "}
              {preview.isPending ? "Läser filen…" : "Välj fil från banken"}
            </Button>
            <Button variant="outline" disabled={sample.isPending} onClick={() => sample.mutate()}>
              <FileDown className="size-4" /> Exempelfil
            </Button>
            <span className="text-xs text-muted-foreground">
              BgMax (.txt) eller camt.054 (.xml) · {data.unpaid} obetalda avier
            </span>
          </div>

          {preview.data && file ? (
            <div className="mt-5">
              <p className="text-sm">
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {preview.data.format === "bgmax" ? "BgMax" : "camt.054"} · {matches.length}{" "}
                  betalningar
                </span>
              </p>
              {matches.length === 0 ? (
                <EmptyState title="Inga inbetalningar i filen" />
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Referens</th>
                        <th className="py-2 pr-3 font-medium">Belopp</th>
                        <th className="py-2 pr-3 font-medium">Datum</th>
                        <th className="py-2 pr-3 font-medium">Avi</th>
                        <th className="py-2 font-medium">Resultat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {matches.map((m, i) => (
                        <tr key={i}>
                          <td className="py-2 pr-3 tnum">{m.reference || "–"}</td>
                          <td className="py-2 pr-3 tnum">{kr(m.amount)}</td>
                          <td className="py-2 pr-3 tnum">{m.date ?? "–"}</td>
                          <td className="py-2 pr-3">
                            {m.payment
                              ? `${m.payment.unit ?? "–"} · ${m.payment.period.slice(0, 7)} · ${kr(m.payment.amount)}`
                              : "–"}
                          </td>
                          <td className="py-2">
                            <StatusPill tone={outcomeLabels[m.outcome].tone}>
                              {outcomeLabels[m.outcome].label}
                            </StatusPill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  disabled={toPay.length === 0 || apply.isPending}
                  onClick={() => apply.mutate(file.content)}
                >
                  {apply.isPending
                    ? "Registrerar…"
                    : `Registrera ${toPay.length} betalningar (${kr(payTotal)})`}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFile(null);
                    preview.reset();
                  }}
                >
                  Avbryt
                </Button>
              </div>
            </div>
          ) : null}
        </Panel>
      </div>

      <Panel
        title="Bokföring (SIE 4)"
        description="Avier och inbetalningar som verifikationer, klara att läsa in i bokföringsprogrammet"
        className="mt-5"
      >
        {data.periods.length === 0 || !range ? (
          <EmptyState title="Inga avier att exportera ännu" />
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>Från</Label>
              <Select value={range.from} onValueChange={(v) => setRange({ ...range, from: v })}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.periods.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Till</Label>
              <Select value={range.to} onValueChange={(v) => setRange({ ...range, to: v })}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.periods.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button disabled={sie.isPending} onClick={() => sie.mutate(range)}>
              <FileDown className="size-4" /> {sie.isPending ? "Skapar…" : "Ladda ner SIE-fil"}
            </Button>
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Konton: 1510 Kundfordringar, 3010 Årsavgifter bostäder, 3020 Hyresintäkter bostäder och
          1930 Företagskonto/bankgiro. I Fortnox: Arkiv → Import → SIE. I Visma eEkonomi: Bokföring
          → Importera verifikationer.
        </p>
      </Panel>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Banker" description="Inbetalningar läses in från bankens fil">
          <ul className="divide-y divide-border">
            {BANKS.map((b) => (
              <li key={b.name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>{b.name}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {b.how}
                  <StatusPill tone="success">Stöds</StatusPill>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Bokföringsprogram" description="Export via SIE 4, standarden alla stödjer">
          <ul className="divide-y divide-border">
            {ACCOUNTING.map((a) => (
              <li
                key={a.name}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm"
              >
                <span>
                  {a.name}
                  {a.next ? (
                    <span className="block text-xs text-muted-foreground">{a.next}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {a.how}
                  <StatusPill tone="success">Stöds</StatusPill>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
