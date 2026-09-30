import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getContractorJobs } from "@/lib/app.functions";
import { EmptyState, Kpi, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { PriorityBadge, RequestStatusBadge } from "@/components/status-badge";
import { dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/entreprenor/")({
  head: () => ({ meta: [{ title: "Mina uppdrag – Boendeplattformen" }] }),
  component: JobsPage,
});

const OPEN = ["new", "received", "assigned", "booked", "in_progress"];

function JobsPage() {
  const fn = useServerFn(getContractorJobs);
  const { data, isPending } = useQuery({ queryKey: ["contractor-jobs"], queryFn: () => fn() });
  if (isPending || !data) return <LoadingBlock rows={4} />;

  const open = data.jobs.filter((j) => OPEN.includes(j.status));
  const done = data.jobs.filter((j) => !OPEN.includes(j.status));
  const company = data.companies.map((c) => c.company).join(", ");

  return (
    <div>
      <PageHeader title="Mina uppdrag" subtitle={company} />
      <div className="mb-5 grid gap-5 sm:grid-cols-3">
        <Kpi label="Att göra" value={open.filter((j) => j.status !== "in_progress").length} />
        <Kpi label="Pågående" value={open.filter((j) => j.status === "in_progress").length} />
        <Kpi
          label="Akuta"
          value={open.filter((j) => j.is_urgent || j.priority === "urgent").length}
          tone={open.some((j) => j.is_urgent || j.priority === "urgent") ? "danger" : "default"}
        />
      </div>
      <div className="space-y-5">
        <JobList title="Öppna uppdrag" jobs={open} empty="Inga öppna uppdrag just nu" />
        <JobList title="Avslutade" jobs={done} empty="Inga avslutade uppdrag" />
      </div>
    </div>
  );
}

type Job = Awaited<ReturnType<typeof getContractorJobs>>["jobs"][number];

function JobList({ title, jobs, empty }: { title: string; jobs: Job[]; empty: string }) {
  return (
    <Panel title={title} padded={jobs.length === 0}>
      {jobs.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <ul className="divide-y divide-border">
          {jobs.map((j) => (
            <li key={j.id}>
              <Link
                to="/entreprenor/$id"
                params={{ id: j.id }}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-surface-muted"
              >
                <div>
                  <p className="text-sm font-medium">
                    #{j.ticket_number} · {j.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {j.units ? `${j.units.address} ${j.units.unit_number}` : "Gemensamma utrymmen"}
                    {j.room ? ` · ${j.room}` : ""} · uppdaterad {dateTime(j.updated_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={j.priority} />
                  <RequestStatusBadge status={j.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
