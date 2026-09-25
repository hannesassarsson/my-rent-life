import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  getMaintenanceProjects,
  saveMaintenanceProject,
  type ProjectStatus,
} from "@/lib/app.functions";
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

type Draft = { id?: string; title: string; year: number; status: ProjectStatus; note: string };

const emptyDraft = (): Draft => ({
  title: "",
  year: new Date().getFullYear(),
  status: "planned",
  note: "",
});

function AdminMaintenance() {
  const fn = useServerFn(getMaintenanceProjects);
  const can = useCan();
  const saveFn = useServerFn(saveMaintenanceProject);
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["admin-projects"], queryFn: () => fn() });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  const save = useMutation({
    mutationFn: () => saveFn({ data: draft }),
    onSuccess: async () => {
      toast.success("Projektet är sparat");
      setOpen(false);
      setDraft(emptyDraft());
      await queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
    },
    onError: () => toast.error("Kunde inte spara projektet"),
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
              <DialogFooter>
                <Button
                  disabled={!draft.title.trim() || save.isPending}
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
    </div>
  );
}
