import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useOrgProfile } from "@/lib/use-org-profile";
import { toast } from "sonner";

import { getMeetings, setMeetingAttendance } from "@/lib/app.functions";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { dateLong } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/moten")({
  head: () => ({
    meta: [
      { title: "Möten – Boendeplattformen" },
      { name: "description", content: "Kommande stämmor och möten med agenda, plats och anmälan." },
      { property: "og:title", content: "Möten – Boendeplattformen" },
      { property: "og:description", content: "Stämmor och möten med agenda och anmälan." },
    ],
  }),
  component: MeetingsPage,
});

function MeetingsPage() {
  const fn = useServerFn(getMeetings);
  const { profile } = useOrgProfile();
  const attend = useServerFn(setMeetingAttendance);
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["meetings"], queryFn: () => fn() });

  const mutation = useMutation({
    mutationFn: (v: { meetingId: string; status: "attending" | "declined" }) => attend({ data: v }),
    onSuccess: () => {
      toast.success("Din anmälan är sparad");
      void qc.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || !data) return <LoadingBlock rows={3} />;

  const now = Date.now();
  const upcoming = data.meetings.filter((m) => new Date(m.starts_at).getTime() >= now);
  const past = data.meetings.filter((m) => new Date(m.starts_at).getTime() < now);
  const statusFor = (id: string) => data.attendance.find((a) => a.meeting_id === id)?.status;

  return (
    <div>
      <PageHeader
        title={profile.meetingsLabel}
        subtitle={
          profile.kind === "brf"
            ? "Stämmor och informationsmöten – anmäl dig här"
            : "Informationsmöten och husmöten – anmäl dig här"
        }
      />

      <div className="space-y-5">
        <Panel title="Kommande möten">
          {upcoming.length === 0 ? (
            <EmptyState title="Inga kommande möten" />
          ) : (
            <ul className="space-y-4">
              {upcoming.map((m) => {
                const status = statusFor(m.id);
                return (
                  <li key={m.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{m.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {dateLong(m.starts_at)} ·{" "}
                          {new Intl.DateTimeFormat("sv-SE", {
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(m.starts_at))}
                          {m.location ? ` · ${m.location}` : ""}
                        </p>
                      </div>
                      {status ? (
                        <StatusPill tone={status === "attending" ? "success" : "neutral"}>
                          {status === "attending" ? "Anmäld" : "Kan inte delta"}
                        </StatusPill>
                      ) : null}
                    </div>
                    {m.agenda ? (
                      <p className="mt-3 text-sm whitespace-pre-line text-muted-foreground">
                        {m.agenda}
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={status === "attending" ? "default" : "outline"}
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate({ meetingId: m.id, status: "attending" })}
                      >
                        Jag kommer
                      </Button>
                      <Button
                        size="sm"
                        variant={status === "declined" ? "default" : "outline"}
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate({ meetingId: m.id, status: "declined" })}
                      >
                        Kan inte delta
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Tidigare möten" description="Protokoll och beslut">
          {past.length === 0 ? (
            <EmptyState title="Inga tidigare möten" />
          ) : (
            <ul className="space-y-3">
              {past.map((m) => (
                <li key={m.id} className="rounded-xl border border-border p-4">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{m.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {dateLong(m.starts_at)}
                        </p>
                      </div>
                      {m.protocol ? (
                        <StatusPill tone="success">Läs protokollet</StatusPill>
                      ) : (
                        <StatusPill tone="neutral">Protokoll saknas</StatusPill>
                      )}
                    </summary>
                    {m.protocol ? (
                      <p className="mt-4 border-t border-border pt-4 text-sm whitespace-pre-line text-muted-foreground">
                        {m.protocol}
                      </p>
                    ) : null}
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
