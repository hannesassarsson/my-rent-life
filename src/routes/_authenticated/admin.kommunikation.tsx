import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  getAdminAnnouncements,
  saveAnnouncement,
  publishAnnouncement,
  type AudienceScope,
} from "@/lib/app.functions";
import { PageHeader, Panel, LoadingBlock, EmptyState } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { dateLong } from "@/lib/format";
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

export const Route = createFileRoute("/_authenticated/admin/kommunikation")({
  component: AdminCommunication,
});

const categories: Record<string, string> = {
  info: "Information",
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
};

const emptyDraft: Draft = {
  title: "",
  body: "",
  category: "info",
  audienceScope: "organization",
  propertyId: null,
  buildingId: null,
};

function AdminCommunication() {
  const fn = useServerFn(getAdminAnnouncements);
  const saveFn = useServerFn(saveAnnouncement);
  const publishFn = useServerFn(publishAnnouncement);
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["admin-announcements"], queryFn: () => fn() });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
  }

  const save = useMutation({
    mutationFn: (publish: boolean) => saveFn({ data: { ...draft, publish } }),
    onSuccess: async () => {
      toast.success("Inlägget är sparat");
      setOpen(false);
      setDraft(emptyDraft);
      await refresh();
    },
    onError: () => toast.error("Kunde inte spara inlägget"),
  });

  const togglePublish = useMutation({
    mutationFn: (vars: { id: string; publish: boolean }) => publishFn({ data: vars }),
    onSuccess: async (_r, vars) => {
      toast.success(vars.publish ? "Inlägget är publicerat" : "Inlägget är avpublicerat");
      await refresh();
    },
    onError: () => toast.error("Kunde inte ändra publicering"),
  });

  const buildings = (data?.buildings ?? []).filter(
    (b) => !draft.propertyId || b.property_id === draft.propertyId,
  );

  return (
    <div>
      <PageHeader
        title="Kommunikation"
        subtitle="Information till boende – hela föreningen, en fastighet eller ett hus"
        action={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setDraft(emptyDraft);
            }}
          >
            <DialogTrigger asChild>
              <Button>Nytt inlägg</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{draft.id ? "Redigera inlägg" : "Nytt inlägg"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="title">Rubrik</Label>
                  <Input
                    id="title"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="body">Text</Label>
                  <Textarea
                    id="body"
                    rows={6}
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
                        onValueChange={(v) =>
                          setDraft({ ...draft, propertyId: v, buildingId: null })
                        }
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
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  disabled={!draft.title.trim() || save.isPending}
                  onClick={() => save.mutate(false)}
                >
                  Spara utkast
                </Button>
                <Button
                  disabled={!draft.title.trim() || !draft.body.trim() || save.isPending}
                  onClick={() => save.mutate(true)}
                >
                  Publicera
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isPending ? (
        <LoadingBlock rows={4} />
      ) : (data?.announcements ?? []).length === 0 ? (
        <EmptyState title="Inga inlägg" description="Skriv det första inlägget till boende." />
      ) : (
        <Panel padded={false}>
          <ul className="divide-y divide-border">
            {data!.announcements.map((a) => (
              <li key={a.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.body}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {categories[a.category as string] ?? a.category} ·{" "}
                      {a.audience_scope === "organization"
                        ? "Alla boende"
                        : a.buildings?.name
                          ? `Hus ${a.buildings.name}`
                          : (a.properties?.name ?? "Riktat")}{" "}
                      · {dateLong(a.published_at ?? a.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {a.is_pinned ? <StatusPill tone="info">Fäst</StatusPill> : null}
                    <StatusPill tone={a.is_published ? "success" : "warning"}>
                      {a.is_published ? "Publicerad" : "Utkast"}
                    </StatusPill>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={togglePublish.isPending}
                      onClick={() => togglePublish.mutate({ id: a.id, publish: !a.is_published })}
                    >
                      {a.is_published ? "Avpublicera" : "Publicera"}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
