import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getAuditLog } from "@/lib/household.functions";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/historik")({
  head: () => ({ meta: [{ title: "Historik – Boendeplattformen" }] }),
  component: AuditLogPage,
});

function AuditLogPage() {
  const fn = useServerFn(getAuditLog);
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["audit-log"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fn({ data: pageParam ? { before: pageParam } : {} }),
    getNextPageParam: (last) =>
      last.length === 100 ? last[last.length - 1]?.created_at : undefined,
  });
  const rows = data?.pages.flat() ?? [];

  return (
    <div>
      <PageHeader
        title="Historik"
        subtitle="Vem som gjort vad: inflyttningar, flyttar, inbjudningar, roller och föreningens uppgifter."
      />
      {isPending ? (
        <LoadingBlock rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Inga ändringar ännu"
          description="Här syns ändringar av boende, inbjudningar och roller när de görs."
        />
      ) : (
        <Panel padded={false}>
          <ol className="divide-y divide-border">
            {rows.map((h) => (
              <li key={h.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3">
                <time className="w-40 shrink-0 text-sm text-muted-foreground tnum">
                  {dateTime(h.created_at)}
                </time>
                <p className="min-w-0 flex-1 text-sm">
                  {h.summary}
                  {h.actor_name ? (
                    <span className="text-muted-foreground"> – {h.actor_name}</span>
                  ) : null}
                </p>
                {h.unit_id ? (
                  <Link
                    to="/admin/lagenheter/$id"
                    params={{ id: h.unit_id }}
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Visa lägenheten
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
          {hasNextPage ? (
            <div className="border-t border-border p-4 text-center">
              <Button
                variant="outline"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Hämtar…" : "Visa äldre händelser"}
              </Button>
            </div>
          ) : null}
        </Panel>
      )}
    </div>
  );
}
