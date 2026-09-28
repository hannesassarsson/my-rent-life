import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { getAdminSettings, getMe, setMemberRole } from "@/lib/app.functions";
import { PageHeader, Panel, LoadingBlock, EmptyState } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { DeliveryAdmin } from "@/components/delivery-admin";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/permissions";
import { errorMessage } from "@/lib/errors";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/installningar")({
  head: () => ({ meta: [{ title: "Användare och roller – Boendeplattformen" }] }),
  component: AdminSettings,
});

type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Vad varje roll får göra, i klartext. */
const ROLE_DESCRIPTIONS: Record<AssignableRole, string> = {
  org_admin: "Allt, även föreningsinställningar, roller och abonnemang.",
  property_manager: "Sköter boende, lägenheter, ekonomi och ärenden. Ändrar inte roller.",
  board_member: "Läser ekonomi och ärenden, skriver nyheter, dokument och möten.",
  staff: "Hanterar felanmälningar, bokningar och besiktningar.",
  contractor: "Ser bara de uppdrag som tilldelats företaget.",
  resident: "Ser sitt eget boende, sina ärenden och föreningens information.",
};

function AdminSettings() {
  const fn = useServerFn(getAdminSettings);
  const meFn = useServerFn(getMe);
  const roleFn = useServerFn(setMemberRole);
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["admin-settings"], queryFn: () => fn() });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });

  const changeRole = useMutation({
    mutationFn: (d: { userId: string; role: AssignableRole }) => roleFn({ data: d }),
    onSuccess: (_res, d) => {
      toast.success(`Rollen är ändrad till ${ROLE_LABELS[d.role]?.toLowerCase()}`);
      void qc.invalidateQueries({ queryKey: ["admin-settings"] });
      void qc.invalidateQueries({ queryKey: ["audit-log"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Användare och roller"
        subtitle="Vem som får göra vad. Nya boende bjuds in från lägenhetens sida."
      />

      {isPending || !data ? (
        <LoadingBlock rows={4} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Panel
            title="Konton i föreningen"
            description={`${data.members.length} konton. Välj roll i listan; ändringen gäller direkt.`}
            padded={false}
          >
            {data.members.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="Inga konton ännu"
                  description="Bjud in boende från sidan Lägenheter."
                  action={
                    <Link to="/admin/lagenheter" className="text-sm font-medium text-primary">
                      Till lägenheterna
                    </Link>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.members.map((m) => {
                  const current = m.roles.find((r): r is AssignableRole =>
                    (ASSIGNABLE_ROLES as readonly string[]).includes(r),
                  );
                  const isMe = m.id === me?.userId;
                  return (
                    <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="truncate text-sm font-medium">
                          {m.full_name ?? "—"}{" "}
                          {isMe ? <span className="text-muted-foreground">(du)</span> : null}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">{m.email}</p>
                      </div>
                      {isMe ? (
                        <StatusPill tone="neutral">
                          {m.roles.map((r) => ROLE_LABELS[r] ?? r).join(", ")}
                        </StatusPill>
                      ) : (
                        <Select
                          value={current ?? ""}
                          disabled={changeRole.isPending}
                          onValueChange={(v) =>
                            changeRole.mutate({ userId: m.id, role: v as AssignableRole })
                          }
                        >
                          <SelectTrigger
                            className="w-full sm:w-52"
                            aria-label={`Roll för ${m.full_name ?? m.email}`}
                          >
                            <SelectValue placeholder="Ingen roll" />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSIGNABLE_ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Vad rollerna får göra">
            <dl className="space-y-3">
              {ASSIGNABLE_ROLES.map((r) => (
                <div key={r}>
                  <dt className="text-sm font-medium">{ROLE_LABELS[r]}</dt>
                  <dd className="text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-muted-foreground">
              Du kan inte ändra din egen roll, så att föreningen aldrig blir utan administratör.
            </p>
          </Panel>
        </div>
      )}

      <div className="mt-6">
        <DeliveryAdmin />
      </div>
    </div>
  );
}
