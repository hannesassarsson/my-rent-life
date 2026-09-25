import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  deleteMeeting,
  getAdminMeetings,
  saveMeeting,
  type MeetingType,
} from "@/lib/app.functions";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { dateLong } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/moten")({
  head: () => ({ meta: [{ title: "Möten – Boendeplattformen" }] }),
  component: AdminMeetingsPage,
});

const meetingTypeLabels: Record<MeetingType, string> = {
  annual: "Ordinarie stämma",
  extra: "Extrastämma",
  info: "Informationsmöte",
  board: "Styrelsemöte",
};

type Meeting = Awaited<ReturnType<typeof getAdminMeetings>>["meetings"][number];

type Draft = {
  id?: string;
  title: string;
  meetingType: MeetingType;
  startsAt: string;
  location: string;
  agenda: string;
  motions: string;
  protocol: string;
};

const emptyDraft = (): Draft => ({
  title: "",
  meetingType: "info",
  startsAt: "",
  location: "",
  agenda: "",
  motions: "",
  protocol: "",
});

/** ISO-tid till värde för <input type="datetime-local"> i lokal tid. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const time = new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit" });

function AdminMeetingsPage() {
  const fn = useServerFn(getAdminMeetings);
  const saveFn = useServerFn(saveMeeting);
  const deleteFn = useServerFn(deleteMeeting);
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["admin-meetings"], queryFn: () => fn() });
  const [draft, setDraft] = useState<Draft | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-meetings"] });
    void qc.invalidateQueries({ queryKey: ["meetings"] });
  };

  const save = useMutation({
    mutationFn: (d: Draft) =>
      saveFn({
        data: {
          ...(d.id ? { id: d.id } : {}),
          title: d.title,
          meetingType: d.meetingType,
          startsAt: new Date(d.startsAt).toISOString(),
          location: d.location,
          agenda: d.agenda,
          motions: d.motions,
          protocol: d.protocol,
        },
      }),
    onSuccess: () => {
      setDraft(null);
      toast.success("Mötet är sparat");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      setDraft(null);
      toast.success("Mötet är borttaget");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || !data) return <LoadingBlock rows={4} />;

  const now = Date.now();
  const upcoming = data.meetings
    .filter((m) => new Date(m.starts_at).getTime() >= now)
    .sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1));
  const past = data.meetings.filter((m) => new Date(m.starts_at).getTime() < now);
  const attendanceFor = (id: string) => data.attendance.filter((a) => a.meeting_id === id);

  const edit = (m: Meeting) =>
    setDraft({
      id: m.id,
      title: m.title,
      meetingType: (m.meeting_type in meetingTypeLabels ? m.meeting_type : "info") as MeetingType,
      startsAt: toLocalInput(m.starts_at),
      location: m.location ?? "",
      agenda: m.agenda ?? "",
      motions: m.motions ?? "",
      protocol: m.protocol ?? "",
    });

  return (
    <div>
      <PageHeader
        title="Möten"
        subtitle="Kalla till stämmor och möten, följ anmälningar och skriv protokoll"
        action={<Button onClick={() => setDraft(emptyDraft())}>Nytt möte</Button>}
      />

      <div className="space-y-5">
        <Panel title="Kommande möten">
          {upcoming.length === 0 ? (
            <EmptyState title="Inga kommande möten" description="Skapa ett möte för att kalla." />
          ) : (
            <ul className="space-y-4">
              {upcoming.map((m) => {
                const attendance = attendanceFor(m.id);
                const coming = attendance.filter((a) => a.status === "attending");
                return (
                  <li key={m.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{m.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {meetingTypeLabels[m.meeting_type as MeetingType] ?? m.meeting_type} ·{" "}
                          {dateLong(m.starts_at)} {time.format(new Date(m.starts_at))}
                          {m.location ? ` · ${m.location}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusPill tone="success">{coming.length} anmälda</StatusPill>
                        <StatusPill tone="neutral">
                          {attendance.length - coming.length} kan inte
                        </StatusPill>
                        <Button size="sm" variant="outline" onClick={() => edit(m)}>
                          Redigera
                        </Button>
                      </div>
                    </div>
                    {coming.length > 0 ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Anmälda: {coming.map((a) => a.attendee_name ?? "Okänd").join(", ")}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title="Tidigare möten"
          description="Skriv protokoll så att de boende kan läsa beslut"
        >
          {past.length === 0 ? (
            <EmptyState title="Inga tidigare möten" />
          ) : (
            <ul className="space-y-3">
              {past.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
                >
                  <div>
                    <p className="text-sm font-medium">{m.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {dateLong(m.starts_at)} · {attendanceFor(m.id).length} svar på kallelsen
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill tone={m.protocol ? "success" : "warning"}>
                      {m.protocol ? "Protokoll klart" : "Protokoll saknas"}
                    </StatusPill>
                    <Button size="sm" variant="outline" onClick={() => edit(m)}>
                      {m.protocol ? "Redigera" : "Skriv protokoll"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Dialog open={!!draft} onOpenChange={(v) => !v && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Redigera möte" : "Nytt möte"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="title">Rubrik</Label>
                <Input
                  id="title"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Typ</Label>
                  <Select
                    value={draft.meetingType}
                    onValueChange={(v) => setDraft({ ...draft, meetingType: v as MeetingType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(meetingTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startsAt">Tid</Label>
                  <Input
                    id="startsAt"
                    type="datetime-local"
                    value={draft.startsAt}
                    onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Plats</Label>
                <Input
                  id="location"
                  value={draft.location}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agenda">Dagordning</Label>
                <Textarea
                  id="agenda"
                  rows={4}
                  value={draft.agenda}
                  onChange={(e) => setDraft({ ...draft, agenda: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="motions">Motioner</Label>
                <Textarea
                  id="motions"
                  rows={2}
                  value={draft.motions}
                  onChange={(e) => setDraft({ ...draft, motions: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="protocol">Protokoll och beslut</Label>
                <Textarea
                  id="protocol"
                  rows={5}
                  value={draft.protocol}
                  placeholder="Fylls i efter mötet – visas för de boende under Möten."
                  onChange={(e) => setDraft({ ...draft, protocol: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap justify-between gap-2 pt-2">
                {draft.id ? (
                  <Button
                    variant="outline"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(draft.id!)}
                  >
                    Ta bort mötet
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  disabled={!draft.title.trim() || !draft.startsAt || save.isPending}
                  onClick={() => save.mutate(draft)}
                >
                  {save.isPending ? "Sparar…" : "Spara"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
