import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { getAdminSettings, getMe, setMemberRole, updateOrganization } from "@/lib/app.functions";
import { PageHeader, Panel, DataRow, LoadingBlock, EmptyState } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { dateLong } from "@/lib/format";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/installningar")({
  component: AdminSettings,
});

type OrgType = "brf" | "rental" | "manager";

const orgTypeLabels: Record<OrgType, string> = {
  brf: "Bostadsrättsförening",
  rental: "Hyresfastigheter",
  manager: "Förvaltare",
};

type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

function AdminSettings() {
  const fn = useServerFn(getAdminSettings);
  const meFn = useServerFn(getMe);
  const updateOrgFn = useServerFn(updateOrganization);
  const roleFn = useServerFn(setMemberRole);
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["admin-settings"], queryFn: () => fn() });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const [org, setOrg] = useState<{ name: string; orgType: OrgType } | null>(null);

  const saveOrg = useMutation({
    mutationFn: (d: { name: string; orgType: OrgType }) => updateOrgFn({ data: d }),
    onSuccess: () => {
      setOrg(null);
      toast.success("Organisationen är sparad");
      void qc.invalidateQueries({ queryKey: ["admin-settings"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeRole = useMutation({
    mutationFn: (d: { userId: string; role: AssignableRole }) => roleFn({ data: d }),
    onSuccess: (_res, d) => {
      toast.success(`Rollen är ändrad till ${ROLE_LABELS[d.role]?.toLowerCase()}`);
      void qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const orgType = (data?.organization?.org_type ?? "brf") as OrgType;

  return (
    <div>
      <PageHeader title="Inställningar" subtitle="Organisation, användare och roller" />

      {isPending || !data ? (
        <LoadingBlock rows={4} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Panel
            title="Organisation"
            action={
              org ? null : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOrg({ name: data.organization?.name ?? "", orgType })}
                >
                  Ändra
                </Button>
              )
            }
          >
            {org ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Namn</Label>
                  <Input
                    id="org-name"
                    value={org.name}
                    onChange={(e) => setOrg({ ...org, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Typ</Label>
                  <Select
                    value={org.orgType}
                    onValueChange={(v) => setOrg({ ...org, orgType: v as OrgType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(orgTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={!org.name.trim() || saveOrg.isPending}
                    onClick={() => saveOrg.mutate(org)}
                  >
                    {saveOrg.isPending ? "Sparar…" : "Spara"}
                  </Button>
                  <Button variant="ghost" onClick={() => setOrg(null)}>
                    Avbryt
                  </Button>
                </div>
              </div>
            ) : (
              <dl>
                <DataRow label="Namn" value={data.organization?.name ?? "—"} />
                <DataRow label="Typ" value={orgTypeLabels[orgType] ?? orgType} />
                <DataRow label="Fastigheter" value={data.propertyCount} />
                <DataRow
                  label="Skapad"
                  value={
                    data.organization?.created_at ? dateLong(data.organization.created_at) : "—"
                  }
                />
              </dl>
            )}
          </Panel>

          <Panel
            title="Användare och roller"
            description={`${data.members.length} konton i organisationen. Nya konton skapas i Supabase och får sin roll här.`}
            padded={false}
          >
            {data.members.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Inga konton ännu" />
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
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {m.full_name ?? "—"}{" "}
                          {isMe ? <span className="text-muted-foreground">(du)</span> : null}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{m.email}</p>
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
                            className="w-48"
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
        </div>
      )}
    </div>
  );
}
