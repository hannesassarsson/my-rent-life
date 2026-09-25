import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { getAdminResidents, moveInResident } from "@/lib/app.functions";
import { PageHeader, Panel, LoadingBlock, EmptyState } from "@/components/ui-kit";
import { StatusPill } from "@/components/status-badge";
import { dateLong, toDateInput } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCan } from "@/lib/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/boende/")({
  component: AdminResidents,
});

type Filter = "active" | "moved_out" | "all";

type MoveIn = {
  unitId: string;
  residentName: string;
  email: string;
  phone: string;
  tenure: "owned" | "rented";
  moveInDate: string;
};

function AdminResidents() {
  const fn = useServerFn(getAdminResidents);
  const moveInFn = useServerFn(moveInResident);
  const can = useCan();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isPending } = useQuery({ queryKey: ["admin-residents"], queryFn: () => fn() });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [moveIn, setMoveIn] = useState<MoveIn | null>(null);

  const rows = useMemo(() => {
    const all = (data?.residents ?? []).filter((r) =>
      filter === "all" ? true : filter === "active" ? r.status === "active" : r.status !== "active",
    );
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((r) =>
      [r.resident_name, r.email, r.units?.unit_number, r.units?.address]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [data, q, filter]);

  const save = useMutation({
    mutationFn: (m: MoveIn) => moveInFn({ data: m }),
    onSuccess: (res) => {
      setMoveIn(null);
      toast.success("Inflyttningen är registrerad");
      void qc.invalidateQueries({ queryKey: ["admin-residents"] });
      void qc.invalidateQueries({ queryKey: ["admin-units"] });
      void navigate({ to: "/admin/boende/$id", params: { id: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeCount = data?.residents.filter((r) => r.status === "active").length ?? 0;
  const movedCount = (data?.residents.length ?? 0) - activeCount;

  return (
    <div>
      <PageHeader
        title="Boende"
        subtitle={
          data ? `${activeCount} boende · ${data.vacantUnits.length} lediga lägenheter` : undefined
        }
        action={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Sök namn, e-post, lägenhet…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            {can("residents.edit") ? (
              <Button
                disabled={!data || data.vacantUnits.length === 0}
                onClick={() =>
                  setMoveIn({
                    unitId: data?.vacantUnits[0]?.id ?? "",
                    residentName: "",
                    email: "",
                    phone: "",
                    tenure: data?.vacantUnits[0]?.tenure ?? "owned",
                    moveInDate: toDateInput(new Date()),
                  })
                }
              >
                Registrera inflytt
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["active", `Aktiva (${activeCount})`],
            ["moved_out", `Utflyttade (${movedCount})`],
            ["all", "Alla"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-full border border-border px-3 py-1.5 text-sm transition hover:border-primary",
              filter === value && "border-primary bg-accent font-medium",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isPending ? (
        <LoadingBlock rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState title="Inga boende matchar sökningen" />
      ) : (
        <Panel padded={false}>
          <ul className="divide-y divide-border">
            {rows.slice(0, 200).map((r) => (
              <li key={r.id}>
                <Link
                  to="/admin/boende/$id"
                  params={{ id: r.id }}
                  className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.resident_name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {r.units?.address} · {r.units?.unit_number} · inflytt{" "}
                      {dateLong(r.move_in_date)}
                      {r.move_out_date ? ` · utflytt ${dateLong(r.move_out_date)}` : ""}
                    </p>
                  </div>
                  <span className="hidden w-52 truncate text-xs text-muted-foreground sm:block">
                    {r.email ?? "—"}
                  </span>
                  {r.status !== "active" ? <StatusPill tone="neutral">Utflyttad</StatusPill> : null}
                  <StatusPill tone={r.tenure === "rented" ? "info" : "neutral"}>
                    {r.tenure === "rented" ? "Hyresgäst" : "Medlem"}
                  </StatusPill>
                  <StatusPill tone={r.user_id ? "success" : "warning"}>
                    {r.user_id ? "Har konto" : "Inget konto"}
                  </StatusPill>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Dialog open={!!moveIn} onOpenChange={(v) => !v && setMoveIn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrera inflytt</DialogTitle>
          </DialogHeader>
          {moveIn && data ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Lägenhet</Label>
                <Select
                  value={moveIn.unitId}
                  onValueChange={(v) =>
                    setMoveIn({
                      ...moveIn,
                      unitId: v,
                      tenure: data.vacantUnits.find((u) => u.id === v)?.tenure ?? moveIn.tenure,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {data.vacantUnits.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.address} · {u.unit_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="residentName">Namn</Label>
                <Input
                  id="residentName"
                  value={moveIn.residentName}
                  onChange={(e) => setMoveIn({ ...moveIn, residentName: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">E-post</Label>
                  <Input
                    id="email"
                    type="email"
                    value={moveIn.email}
                    onChange={(e) => setMoveIn({ ...moveIn, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={moveIn.phone}
                    onChange={(e) => setMoveIn({ ...moveIn, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Upplåtelseform</Label>
                  <Select
                    value={moveIn.tenure}
                    onValueChange={(v) => setMoveIn({ ...moveIn, tenure: v as MoveIn["tenure"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owned">Bostadsrätt</SelectItem>
                      <SelectItem value="rented">Hyresrätt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="moveInDate">Inflyttningsdatum</Label>
                  <Input
                    id="moveInDate"
                    type="date"
                    value={moveIn.moveInDate}
                    onChange={(e) => setMoveIn({ ...moveIn, moveInDate: e.target.value })}
                  />
                </div>
              </div>
              <Button
                className="w-full"
                disabled={
                  !moveIn.unitId ||
                  !moveIn.residentName.trim() ||
                  !moveIn.moveInDate ||
                  save.isPending
                }
                onClick={() => save.mutate(moveIn)}
              >
                {save.isPending ? "Sparar…" : "Registrera"}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
