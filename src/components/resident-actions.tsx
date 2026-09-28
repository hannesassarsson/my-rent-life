import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { moveOutResident, updateResident } from "@/lib/app.functions";
import { toDateInput } from "@/lib/format";
import { useCan } from "@/lib/use-can";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { errorMessage } from "@/lib/errors";

type Residency = {
  id: string;
  resident_name: string;
  email: string | null;
  phone: string | null;
  tenure: "owned" | "rented";
  move_in_date: string | null;
  status: string;
};

type EditDraft = {
  residentName: string;
  email: string;
  phone: string;
  tenure: "owned" | "rented";
  moveInDate: string;
};

/** Knappar och dialoger för att redigera en boende och registrera utflytt. */
export function ResidentActions({
  residency,
  size,
}: {
  residency: Residency;
  size?: "sm" | "default";
}) {
  const can = useCan();
  const qc = useQueryClient();
  const updateFn = useServerFn(updateResident);
  const moveOutFn = useServerFn(moveOutResident);
  const [edit, setEdit] = useState<EditDraft | null>(null);
  const [moveOut, setMoveOut] = useState<{ date: string; vacate: boolean } | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["resident-detail", residency.id] });
    void qc.invalidateQueries({ queryKey: ["admin-residents"] });
    void qc.invalidateQueries({ queryKey: ["admin-units"] });
    void qc.invalidateQueries({ queryKey: ["unit-detail"] });
    void qc.invalidateQueries({ queryKey: ["unit-registry"] });
    void qc.invalidateQueries({ queryKey: ["audit-log"] });
  };

  const save = useMutation({
    mutationFn: (d: EditDraft) =>
      updateFn({
        data: {
          id: residency.id,
          residentName: d.residentName,
          email: d.email,
          phone: d.phone,
          tenure: d.tenure,
          ...(d.moveInDate ? { moveInDate: d.moveInDate } : {}),
        },
      }),
    onSuccess: () => {
      setEdit(null);
      toast.success("Uppgifterna är sparade");
      invalidate();
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
  });

  const leave = useMutation({
    mutationFn: (m: { date: string; vacate: boolean }) =>
      moveOutFn({ data: { id: residency.id, moveOutDate: m.date, vacateUnit: m.vacate } }),
    onSuccess: () => {
      setMoveOut(null);
      toast.success("Utflyttningen är registrerad");
      invalidate();
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
  });

  if (!can("residents.edit")) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size={size}
        onClick={() =>
          setEdit({
            residentName: residency.resident_name,
            email: residency.email ?? "",
            phone: residency.phone ?? "",
            tenure: residency.tenure,
            moveInDate: residency.move_in_date ?? "",
          })
        }
      >
        Ändra uppgifter
      </Button>
      {residency.status === "active" ? (
        <Button
          variant="outline"
          size={size}
          onClick={() => setMoveOut({ date: toDateInput(new Date()), vacate: true })}
        >
          Flytta ut
        </Button>
      ) : null}

      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ändra uppgifter för {residency.resident_name}</DialogTitle>
          </DialogHeader>
          {edit ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Namn</Label>
                <Input
                  id="edit-name"
                  value={edit.residentName}
                  onChange={(e) => setEdit({ ...edit, residentName: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-email">E-post</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={edit.email}
                    onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Telefon</Label>
                  <Input
                    id="edit-phone"
                    value={edit.phone}
                    onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Upplåtelseform</Label>
                  <Select
                    value={edit.tenure}
                    onValueChange={(v) => setEdit({ ...edit, tenure: v as EditDraft["tenure"] })}
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
                  <Label htmlFor="edit-movein">Inflyttningsdatum</Label>
                  <Input
                    id="edit-movein"
                    type="date"
                    value={edit.moveInDate}
                    onChange={(e) => setEdit({ ...edit, moveInDate: e.target.value })}
                  />
                </div>
              </div>
              <Button
                className="w-full"
                disabled={!edit.residentName.trim() || save.isPending}
                onClick={() => save.mutate(edit)}
              >
                {save.isPending ? "Sparar…" : "Spara ändringar"}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!moveOut} onOpenChange={(v) => !v && setMoveOut(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flytta ut {residency.resident_name}?</DialogTitle>
          </DialogHeader>
          {moveOut ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Personen tas bort från lägenheten men finns kvar i historiken. Ett kopplat konto
                förlorar tillgången till lägenheten, avgifterna och ärendena.
              </p>
              <div className="space-y-2">
                <Label htmlFor="moveout-date">Utflyttningsdatum</Label>
                <Input
                  id="moveout-date"
                  type="date"
                  value={moveOut.date}
                  onChange={(e) => setMoveOut({ ...moveOut, date: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={moveOut.vacate}
                  onCheckedChange={(v) => setMoveOut({ ...moveOut, vacate: v === true })}
                />
                Markera lägenheten som ledig om ingen annan bor kvar
              </label>
              <Button
                className="w-full"
                disabled={!moveOut.date || leave.isPending}
                onClick={() => leave.mutate(moveOut)}
              >
                {leave.isPending ? "Sparar…" : "Ja, flytta ut"}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
