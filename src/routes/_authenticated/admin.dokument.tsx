import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { deleteDocument, getAdminDocuments, saveDocument } from "@/lib/app.functions";
import { OpenFileButton } from "@/components/open-file-button";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { dateLong, docTypeLabel, docTypeLabels } from "@/lib/format";
import { DOCUMENT_TYPES, checkFile, fileKindOf, formatBytes, uploadFile } from "@/lib/files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { errorMessage } from "@/lib/errors";
import { updateDocument } from "@/lib/manage.functions";
import { ConfirmDialog } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_authenticated/admin/dokument")({
  head: () => ({ meta: [{ title: "Dokument – Boendeplattformen" }] }),
  component: AdminDocumentsPage,
});

type Draft = {
  /** Satt när ett befintligt dokument ändras; då byts inte filen. */
  id?: string;
  title: string;
  docType: string;
  scope: "organization" | "property" | "unit";
  propertyId: string;
  unitId: string;
  file: File | null;
};

const emptyDraft = (): Draft => ({
  title: "",
  docType: "other",
  scope: "organization",
  propertyId: "",
  unitId: "",
  file: null,
});

function AdminDocumentsPage() {
  const fn = useServerFn(getAdminDocuments);
  const saveFn = useServerFn(saveDocument);
  const deleteFn = useServerFn(deleteDocument);
  const updateFn = useServerFn(updateDocument);
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["admin-documents"], queryFn: () => fn() });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [q, setQ] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-documents"] });
    void qc.invalidateQueries({ queryKey: ["documents"] });
  };

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const scope =
        d.scope === "property"
          ? { kind: "property" as const, propertyId: d.propertyId }
          : d.scope === "unit"
            ? { kind: "unit" as const, unitId: d.unitId }
            : { kind: "organization" as const };
      if (d.id) {
        await updateFn({ data: { id: d.id, title: d.title, docType: d.docType, scope } });
        return;
      }
      if (!d.file || !data) throw new Error("Välj en fil");
      checkFile(d.file, DOCUMENT_TYPES);
      const storagePath = await uploadFile(`${data.orgId}/documents`, d.file);
      await saveFn({
        data: {
          title: d.title,
          docType: d.docType,
          scope,
          storagePath,
          fileKind: fileKindOf(d.file),
          fileSize: formatBytes(d.file.size),
        },
      });
    },
    onSuccess: (_r, d) => {
      setDraft(null);
      toast.success(d.id ? "Dokumentet är sparat" : "Dokumentet är uppladdat");
      invalidate();
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Dokumentet är borttaget");
      setConfirmDelete(false);
      setDraft(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
  });

  if (isPending || !data) return <LoadingBlock rows={4} />;

  const list = data.documents.filter((d) =>
    `${d.title} ${docTypeLabel(d.doc_type)}`.toLowerCase().includes(q.toLowerCase()),
  );
  const valid =
    !!draft?.title.trim() &&
    (!!draft.id || !!draft.file) &&
    (draft.scope !== "property" || !!draft.propertyId) &&
    (draft.scope !== "unit" || !!draft.unitId);

  return (
    <div>
      <PageHeader
        title="Dokument"
        subtitle="Stadgar, protokoll, avtal och ritningar – synliga för boende enligt vem de gäller"
        action={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Sök dokument…"
              className="w-full sm:w-56"
            />
            <Button onClick={() => setDraft(emptyDraft())}>Ladda upp</Button>
          </div>
        }
      />

      {list.length === 0 ? (
        <EmptyState title="Inga dokument hittades" />
      ) : (
        <Panel padded={false}>
          <ul className="divide-y divide-border">
            {list.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {docTypeLabel(d.doc_type)} · {d.file_kind?.toUpperCase()}
                    {d.file_size ? ` · ${d.file_size}` : ""} ·{" "}
                    {d.units
                      ? `Lägenhet ${d.units.address} ${d.units.unit_number}`
                      : d.properties?.name
                        ? d.properties.name
                        : "Alla boende"}{" "}
                    · {dateLong(d.created_at)}
                  </p>
                </div>
                <OpenFileButton path={d.storage_path} />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft({
                      id: d.id,
                      title: d.title,
                      docType: d.doc_type,
                      scope: d.unit_id ? "unit" : d.property_id ? "property" : "organization",
                      propertyId: d.property_id ?? "",
                      unitId: d.unit_id ?? "",
                      file: null,
                    })
                  }
                >
                  Ändra
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Dialog open={!!draft} onOpenChange={(v) => !v && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Ändra dokument" : "Ladda upp dokument"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="space-y-3">
              <div className={draft.id ? "hidden" : "space-y-2"}>
                <Label htmlFor="doc-file">Fil</Label>
                <Input
                  id="doc-file"
                  type="file"
                  accept={DOCUMENT_TYPES.join(",")}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setDraft({
                      ...draft,
                      file,
                      title: draft.title || (file?.name.replace(/\.[^.]+$/, "") ?? ""),
                    });
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  PDF, bild, Word eller Excel, högst 10 MB.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-title">Titel</Label>
                <Input
                  id="doc-title"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Typ</Label>
                  <Select
                    value={draft.docType}
                    onValueChange={(v) => setDraft({ ...draft, docType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(docTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Gäller</Label>
                  <Select
                    value={draft.scope}
                    onValueChange={(v) => setDraft({ ...draft, scope: v as Draft["scope"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="organization">Alla boende</SelectItem>
                      <SelectItem value="property">En fastighet</SelectItem>
                      <SelectItem value="unit">En lägenhet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {draft.scope === "property" ? (
                <div className="space-y-2">
                  <Label>Fastighet</Label>
                  <Select
                    value={draft.propertyId}
                    onValueChange={(v) => setDraft({ ...draft, propertyId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Välj fastighet" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {draft.scope === "unit" ? (
                <div className="space-y-2">
                  <Label>Lägenhet</Label>
                  <Select
                    value={draft.unitId}
                    onValueChange={(v) => setDraft({ ...draft, unitId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Välj lägenhet" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.units.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.address} · {u.unit_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <Button
                className="w-full"
                disabled={!valid || save.isPending}
                onClick={() => save.mutate(draft)}
              >
                {save.isPending
                  ? draft.id
                    ? "Sparar…"
                    : "Laddar upp…"
                  : draft.id
                    ? "Spara ändringarna"
                    : "Ladda upp"}
              </Button>
              {draft.id ? (
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  Ta bort dokumentet
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Ta bort ${draft?.title || "dokumentet"}?`}
        pending={remove.isPending}
        onConfirm={() => draft?.id && remove.mutate(draft.id)}
        description={
          <p>
            Dokumentet och filen tas bort och syns inte längre för boende. Det går inte att ångra.
          </p>
        }
      />
    </div>
  );
}
