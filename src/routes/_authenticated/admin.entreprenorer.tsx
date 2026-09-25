import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useCan } from "@/lib/use-can";

import { getContractors, saveContractor } from "@/lib/app.functions";
import { PageHeader, Panel, LoadingBlock, EmptyState } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/entreprenorer")({
  component: AdminContractors,
});

type Draft = {
  id?: string;
  company: string;
  contactName: string;
  phone: string;
  email: string;
  category: string;
  agreementNote: string;
};

const emptyDraft: Draft = {
  company: "",
  contactName: "",
  phone: "",
  email: "",
  category: "",
  agreementNote: "",
};

function AdminContractors() {
  const fn = useServerFn(getContractors);
  const can = useCan();
  const saveFn = useServerFn(saveContractor);
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["admin-contractors"], queryFn: () => fn() });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const save = useMutation({
    mutationFn: () => saveFn({ data: draft }),
    onSuccess: async () => {
      toast.success("Entreprenören är sparad");
      setOpen(false);
      setDraft(emptyDraft);
      await queryClient.invalidateQueries({ queryKey: ["admin-contractors"] });
    },
    onError: () => toast.error("Kunde inte spara entreprenören"),
  });

  function edit(c: NonNullable<typeof data>["contractors"][number]) {
    setDraft({
      id: c.id,
      company: c.company,
      contactName: c.contact_name ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      category: c.category ?? "",
      agreementNote: c.agreement_note ?? "",
    });
    setOpen(true);
  }

  const openCountFor = (id: string) =>
    (data?.requests ?? []).filter(
      (r) => r.contractor_id === id && r.status !== "closed" && r.status !== "resolved",
    ).length;

  return (
    <div>
      <PageHeader
        title="Entreprenörer"
        subtitle="Leverantörer och deras pågående ärenden"
        action={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setDraft(emptyDraft);
            }}
          >
            {can("contractors.edit") ? (
              <DialogTrigger asChild>
                <Button>Ny entreprenör</Button>
              </DialogTrigger>
            ) : null}
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{draft.id ? "Redigera entreprenör" : "Ny entreprenör"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="company">Företag</Label>
                  <Input
                    id="company"
                    value={draft.company}
                    onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="contact">Kontaktperson</Label>
                    <Input
                      id="contact"
                      value={draft.contactName}
                      onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Område</Label>
                    <Input
                      id="category"
                      placeholder="VVS, el, städ…"
                      value={draft.category}
                      onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefon</Label>
                    <Input
                      id="phone"
                      value={draft.phone}
                      onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">E-post</Label>
                    <Input
                      id="email"
                      value={draft.email}
                      onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="note">Avtalsnotering</Label>
                  <Textarea
                    id="note"
                    rows={3}
                    value={draft.agreementNote}
                    onChange={(e) => setDraft({ ...draft, agreementNote: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={!draft.company.trim() || save.isPending}
                  onClick={() => save.mutate()}
                >
                  Spara
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isPending ? (
        <LoadingBlock rows={4} />
      ) : (data?.contractors ?? []).length === 0 ? (
        <EmptyState title="Inga entreprenörer" description="Lägg till din första leverantör." />
      ) : (
        <Panel padded={false}>
          <ul className="divide-y divide-border">
            {data!.contractors.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.company}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {[c.contact_name, c.phone, c.email].filter(Boolean).join(" · ") || "—"}
                  </p>
                  {c.agreement_note ? (
                    <p className="mt-1 text-xs text-muted-foreground">{c.agreement_note}</p>
                  ) : null}
                </div>
                {c.category ? <StatusPill tone="neutral">{c.category}</StatusPill> : null}
                <StatusPill tone={openCountFor(c.id) > 0 ? "info" : "neutral"}>
                  {openCountFor(c.id)} pågående
                </StatusPill>
                {can("contractors.edit") ? (
                  <Button size="sm" variant="outline" onClick={() => edit(c)}>
                    Redigera
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
