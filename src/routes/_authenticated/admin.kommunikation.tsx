import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from "lucide-react";

import {
  getAdminAnnouncements,
  saveAnnouncement,
  publishAnnouncement,
  pinAnnouncement,
  deleteAnnouncement,
  type AudienceScope,
} from "@/lib/app.functions";
import { PageHeader, Panel, LoadingBlock, EmptyState } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { announcementCategory, dateLong } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/admin/kommunikation")({
  component: AdminCommunication,
});

const categories: Record<string, string> = {
  info: "Information",
  news: "Nyheter",
  operations: "Drift",
  maintenance: "Underhåll",
  disruption: "Driftstörning",
  event: "Händelse",
};

type Draft = {
  id?: string;
  title: string;
  body: string;
  category: string;
  audienceScope: AudienceScope;
  propertyId: string | null;
  buildingId: string | null;
  isPinned: boolean;
  /** Om nyheten redan är publicerad när den öppnas. */
  published: boolean;
};

const emptyDraft: Draft = {
  title: "",
  body: "",
  category: "info",
  audienceScope: "organization",
  propertyId: null,
  buildingId: null,
  isPinned: false,
  published: false,
};

type Filter = "alla" | "publicerade" | "utkast";

type Announcement = Awaited<ReturnType<typeof getAdminAnnouncements>>["announcements"][number];

function toDraft(a: Announcement): Draft {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    category: a.category,
    audienceScope: a.audience_scope as AudienceScope,
    propertyId: a.property_id,
    buildingId: a.building_id,
    isPinned: a.is_pinned,
    published: a.is_published,
  };
}

function audienceLabel(a: Announcement) {
  if (a.audience_scope === "organization") return "Alla boende";
  if (a.audience_scope === "building" && a.buildings?.name) return `Hus ${a.buildings.name}`;
  return a.properties?.name ?? "Riktad";
}

function AdminCommunication() {
  const fn = useServerFn(getAdminAnnouncements);
  const saveFn = useServerFn(saveAnnouncement);
  const publishFn = useServerFn(publishAnnouncement);
  const pinFn = useServerFn(pinAnnouncement);
  const deleteFn = useServerFn(deleteAnnouncement);
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["admin-announcements"], queryFn: () => fn() });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [filter, setFilter] = useState<Filter>("alla");
  const [pendingDelete, setPendingDelete] = useState<Announcement | null>(null);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] }),
      queryClient.invalidateQueries({ queryKey: ["announcements"] }),
    ]);
  }

  function openEditor(next: Draft) {
    setDraft(next);
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: (publish: boolean) => {
      const { published: _published, ...fields } = draft;
      return saveFn({ data: { ...fields, publish } });
    },
    onSuccess: async (_r, publish) => {
      toast.success(
        draft.published && publish
          ? "Ändringarna är sparade"
          : publish
            ? "Nyheten är publicerad och boende får en notis"
            : "Utkastet är sparat",
      );
      setOpen(false);
      setDraft(emptyDraft);
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const togglePublish = useMutation({
    mutationFn: (vars: { id: string; publish: boolean }) => publishFn({ data: vars }),
    onSuccess: async (_r, vars) => {
      toast.success(
        vars.publish ? "Nyheten är publicerad och boende får en notis" : "Nyheten är avpublicerad",
      );
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const togglePin = useMutation({
    mutationFn: (vars: { id: string; pinned: boolean }) => pinFn({ data: vars }),
    onSuccess: async (_r, vars) => {
      toast.success(vars.pinned ? "Nyheten är fäst överst" : "Nyheten är inte längre fäst");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (announcementId: string) => deleteFn({ data: { id: announcementId } }),
    onSuccess: async () => {
      toast.success("Nyheten är borttagen");
      setPendingDelete(null);
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const all = data?.announcements ?? [];
  const counts = {
    alla: all.length,
    publicerade: all.filter((a) => a.is_published).length,
    utkast: all.filter((a) => !a.is_published).length,
  };
  const list = all
    .filter((a) =>
      filter === "alla" ? true : filter === "publicerade" ? a.is_published : !a.is_published,
    )
    .sort((x, y) => Number(y.is_pinned) - Number(x.is_pinned));

  const buildings = (data?.buildings ?? []).filter(
    (b) => !draft.propertyId || b.property_id === draft.propertyId,
  );
  const missingAudience =
    (draft.audienceScope !== "organization" && !draft.propertyId) ||
    (draft.audienceScope === "building" && !draft.buildingId);
  const canSave = !!draft.title.trim() && !missingAudience && !save.isPending;
  const canPublish = canSave && !!draft.body.trim();

  return (
    <div>
      <PageHeader
        title="Nyheter till boende"
        subtitle="Skriv nyheter och viktig information – till alla, en fastighet eller ett hus"
        action={<Button onClick={() => openEditor(emptyDraft)}>Skriv en nyhet</Button>}
      />

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setDraft(emptyDraft);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Ändra nyheten" : "Skriv en nyhet"}</DialogTitle>
            <DialogDescription>
              {draft.published
                ? "Nyheten är publicerad. Ändringarna syns direkt för boende, utan en ny notis."
                : "Boende får en notis när nyheten publiceras."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="title">Rubrik</Label>
              <Input
                id="title"
                maxLength={200}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="body">Text</Label>
              <Textarea
                id="body"
                rows={7}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Kategori</Label>
                <Select
                  value={draft.category}
                  onValueChange={(v) => setDraft({ ...draft, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categories).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Målgrupp</Label>
                <Select
                  value={draft.audienceScope}
                  onValueChange={(v) =>
                    setDraft({
                      ...draft,
                      audienceScope: v as AudienceScope,
                      propertyId: v === "organization" ? null : draft.propertyId,
                      buildingId: v === "building" ? draft.buildingId : null,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organization">Alla boende</SelectItem>
                    <SelectItem value="property">En fastighet</SelectItem>
                    <SelectItem value="building">Ett hus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {draft.audienceScope !== "organization" ? (
                <div>
                  <Label>Fastighet</Label>
                  <Select
                    value={draft.propertyId ?? ""}
                    onValueChange={(v) => setDraft({ ...draft, propertyId: v, buildingId: null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Välj fastighet" />
                    </SelectTrigger>
                    <SelectContent>
                      {(data?.properties ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {draft.audienceScope === "building" ? (
                <div>
                  <Label>Hus</Label>
                  <Select
                    value={draft.buildingId ?? ""}
                    onValueChange={(v) => setDraft({ ...draft, buildingId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Välj hus" />
                    </SelectTrigger>
                    <SelectContent>
                      {buildings.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-border p-3">
              <Checkbox
                checked={draft.isPinned}
                onCheckedChange={(v) => setDraft({ ...draft, isPinned: v === true })}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">Fäst överst som viktig</span>
                <span className="block text-sm text-muted-foreground">
                  Visas först för boende och märks med ”Viktigt”.
                </span>
              </span>
            </label>
            {missingAudience ? (
              <p className="text-sm text-muted-foreground">
                Välj {draft.propertyId ? "hus" : "fastighet"} för att kunna spara.
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            {draft.published ? (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Avbryt
                </Button>
                <Button disabled={!canPublish} onClick={() => save.mutate(true)}>
                  {save.isPending ? "Sparar…" : "Spara ändringar"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" disabled={!canSave} onClick={() => save.mutate(false)}>
                  Spara utkast
                </Button>
                <Button disabled={!canPublish} onClick={() => save.mutate(true)}>
                  Publicera
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isPending ? (
        <LoadingBlock rows={4} />
      ) : all.length === 0 ? (
        <EmptyState title="Inga nyheter" description="Skriv den första nyheten till boende." />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Visa nyheter">
            {(["alla", "publicerade", "utkast"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cn(
                  "min-h-10 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-primary",
                  filter === f && "border-primary bg-accent",
                )}
              >
                {f === "alla" ? "Alla" : f === "publicerade" ? "Publicerade" : "Utkast"}{" "}
                <span className="text-muted-foreground">{counts[f]}</span>
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <EmptyState
              title={filter === "utkast" ? "Inga utkast" : "Inga publicerade nyheter"}
              description="Byt visning ovan för att se de andra nyheterna."
            />
          ) : (
            <Panel padded={false}>
              <ul className="divide-y divide-border">
                {list.map((a) => (
                  <li key={a.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <button
                        type="button"
                        onClick={() => openEditor(toDraft(a))}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="text-sm font-medium hover:underline">{a.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.body}</p>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {categories[a.category] ?? announcementCategory(a.category)} ·{" "}
                          {audienceLabel(a)} ·{" "}
                          {a.is_published
                            ? `Publicerad ${dateLong(a.published_at ?? a.created_at)}`
                            : `Skapad ${dateLong(a.created_at)}`}
                          {a.is_published && a.updated_at
                            ? ` · Ändrad ${dateLong(a.updated_at)}`
                            : ""}
                        </p>
                      </button>
                      <div className="flex flex-wrap items-center gap-2">
                        {a.is_pinned ? <StatusPill tone="info">Viktigt</StatusPill> : null}
                        <StatusPill tone={a.is_published ? "success" : "warning"}>
                          {a.is_published ? "Publicerad" : "Utkast"}
                        </StatusPill>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditor(toDraft(a))}
                          >
                            <Pencil className="size-4" aria-hidden />
                            Redigera
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Fler val för ${a.title}`}
                              >
                                <MoreHorizontal className="size-4" aria-hidden />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                disabled={
                                  togglePublish.isPending || (!a.is_published && !a.body.trim())
                                }
                                onSelect={() =>
                                  togglePublish.mutate({ id: a.id, publish: !a.is_published })
                                }
                              >
                                {a.is_published ? (
                                  <EyeOff className="size-4" aria-hidden />
                                ) : (
                                  <Eye className="size-4" aria-hidden />
                                )}
                                {a.is_published ? "Avpublicera" : "Publicera"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={togglePin.isPending}
                                onSelect={() =>
                                  togglePin.mutate({ id: a.id, pinned: !a.is_pinned })
                                }
                              >
                                {a.is_pinned ? (
                                  <PinOff className="size-4" aria-hidden />
                                ) : (
                                  <Pin className="size-4" aria-hidden />
                                )}
                                {a.is_pinned ? "Lossa från toppen" : "Fäst överst"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => setPendingDelete(a)}
                              >
                                <Trash2 className="size-4" aria-hidden />
                                Ta bort
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort nyheten?</AlertDialogTitle>
            <AlertDialogDescription>
              ”{pendingDelete?.title}”{" "}
              {pendingDelete?.is_published
                ? "försvinner för alla boende. Det går inte att ångra."
                : "tas bort. Det går inte att ångra."}{" "}
              Vill du bara dölja den tillfälligt kan du avpublicera den i stället.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Behåll nyheten</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (pendingDelete) remove.mutate(pendingDelete.id);
              }}
            >
              {remove.isPending ? "Tar bort…" : "Ta bort"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
