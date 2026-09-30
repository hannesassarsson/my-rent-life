import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  getAdminProperties,
  getMaintenanceProjects,
  saveMaintenanceProject,
  type ProjectStatus,
} from "@/lib/app.functions";
import { deleteMaintenanceProject } from "@/lib/manage.functions";
import { errorMessage } from "@/lib/errors";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader, Panel, LoadingBlock, EmptyState } from "@/components/ui-kit";
import { ProjectStatusBadge } from "@/components/status-badge";
import { kr } from "@/lib/format";
import { useCan } from "@/lib/use-can";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/underhall")({
  component: AdminMaintenance,
});

type Draft = {
  id?: string;
  title: string;
  year: number;
  status: ProjectStatus;
  note: string;
  budget: string;
  propertyId: string | null;
};

const emptyDraft = (): Draft => ({
  title: "",
  year: new Date().getFullYear(),
  status: "planned",
  note: "",
  budget: "",
  propertyId: null,
});

const ALL_PROPERTIES = "__all__";

function AdminMaintenance() {
  const fn = useServerFn(getMaintenanceProjects);
  const can = useCan();
  const saveFn = useServerFn(saveMaintenanceProject);
  const deleteFn = useServerFn(deleteMaintenanceProject);
  const propFn = useServerFn(getAdminProperties);
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["admin-projects"], queryFn: () => fn() });
  const { data: props } = useQuery({ queryKey: ["admin-properties"], queryFn: () => propFn() });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const budget = draft.budget.trim() === "" ? null : Number(draft.budget.replace(/\s/g, ""));
  const budgetInvalid = budget !== null && (!Number.isFinite(budget) || budget < 0);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          ...(draft.id ? { id: draft.id } : {}),
          title: draft.title,
          year: draft.year,
          status: draft.status,
          note: draft.note,
          budget,
          propertyId: draft.propertyId,
        },
      }),
    onSuccess: async () => {
      toast.success("Projektet är sparat");
      setOpen(false);
      setDraft(emptyDraft());
      await queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (projectId: string) => deleteFn({ data: { id: projectId } }),
    onSuccess: async () => {
      toast.success("Projektet är borttaget");
      setConfirmDelete(false);
      setOpen(false);
      setDraft(emptyDraft());
      await queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const years = [...new Set((data ?? []).map((p) => p.year))].sort((a, b) => a - b);

  return (
    <div>
      <PageHeader
        title="Underhållsplan"
        subtitle="Planerade och pågående projekt över tid"
        action={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setDraft(emptyDraft());
            }}
          >
            {can("maintenance.edit") ? (
              <DialogTrigger asChild>
                <Button>Nytt projekt</Button>
              </DialogTrigger>
            ) : null}
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{draft.id ? "Redigera projekt" : "Nytt projekt"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="title">Titel</Label>
                  <Input
                    id="title"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="year">År</Label>
                    <Input
                      id="year"
                      type="number"
                      value={draft.year}
                      onChange={(e) => setDraft({ ...draft, year: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={draft.status}
                      onValueChange={(v) => setDraft({ ...draft, status: v as ProjectStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">Planerat</SelectItem>
                        <SelectItem value="in_progress">Pågående</SelectItem>
                        <SelectItem value="done">Klart</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="budget">Budget (kr)</Label>
                    <Input
                      id="budget"
                      inputMode="numeric"
                      placeholder="t.ex. 450000"
                      value={draft.budget}
                      onChange={(e) => setDraft({ ...draft, budget: e.target.value })}
                      aria-invalid={budgetInvalid}
                    />
                  </div>
                  <div>
                    <Label>Gäller</Label>
                    <Select
                      value={draft.propertyId ?? ALL_PROPERTIES}
                      onValueChange={(v) =>
                        setDraft({ ...draft, propertyId: v === ALL_PROPERTIES ? null : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_PROPERTIES}>Hela föreningen</SelectItem>
                        {(props?.properties ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="note">Notering</Label>
                  <Textarea
                    id="note"
                    rows={3}
                    value={draft.note}
                    onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                {draft.id ? (
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Ta bort projektet
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  disabled={!draft.title.trim() || budgetInvalid || save.isPending}
                  onClick={() => save.mutate()}
                >
                  {save.isPending ? "Sparar…" : "Spara"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isPending ? (
        <LoadingBlock rows={4} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="Inga projekt" description="Lägg till det första underhållsprojektet." />
      ) : (
        <div className="space-y-6">
          {years.map((year) => (
            <Panel key={year} title={String(year)} padded={false}>
              <ul className="divide-y divide-border">
                {data!
                  .filter((p) => p.year === year)
                  .map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {p.properties?.name ?? "Hela föreningen"}
                          {p.note ? ` · ${p.note}` : ""}
                        </p>
                      </div>
                      {p.budget ? (
                        <span className="text-sm font-medium tnum">{kr(Number(p.budget))}</span>
                      ) : null}
                      <ProjectStatusBadge status={p.status as string} />
                      <Button
                        size="sm"
                        variant="outline"
                        hidden={!can("maintenance.edit")}
                        onClick={() => {
                          setDraft({
                            id: p.id,
                            title: p.title,
                            year: p.year,
                            status: p.status as ProjectStatus,
                            note: p.note ?? "",
                            budget: p.budget != null ? String(Number(p.budget)) : "",
                            propertyId: p.property_id,
                          });
                          setOpen(true);
                        }}
                      >
                        Redigera
                      </Button>
                    </li>
                  ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Ta bort ${draft.title || "projektet"}?`}
        pending={remove.isPending}
        onConfirm={() => draft.id && remove.mutate(draft.id)}
        description={
          <p>
            Projektet tas bort ur underhållsplanen. Det går inte att ångra. Är det genomfört kan du
            i stället sätta status Klart.
          </p>
        }
      />
    </div>
  );
}
