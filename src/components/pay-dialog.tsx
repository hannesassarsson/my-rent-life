import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Banknote, CreditCard, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { payMyPayment } from "@/lib/app.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { dateLong, kr, monthName } from "@/lib/format";

export type PayMethod = "card" | "swish" | "bank";

const methods: {
  id: PayMethod;
  label: string;
  description: string;
  icon: typeof CreditCard;
}[] = [
  {
    id: "card",
    label: "Kort",
    description: "Betala direkt med kort. Registreras automatiskt.",
    icon: CreditCard,
  },
  {
    id: "swish",
    label: "Swish",
    description: "Öppna Swish på din mobil och godkänn betalningen.",
    icon: Smartphone,
  },
  {
    id: "bank",
    label: "Banköverföring",
    description: "Få bankgiro och OCR-nummer för manuell betalning.",
    icon: Banknote,
  },
];

export function PayDialog({
  payment,
  kindLabel,
  bankgiro,
}: {
  payment: {
    id: string;
    amount: number | string;
    period: string;
    due_date: string;
    ocr?: string | null;
  };
  kindLabel: string;
  bankgiro?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PayMethod>("card");
  const payFn = useServerFn(payMyPayment);
  const qc = useQueryClient();
  const ocr = payment.ocr ?? "–";

  const pay = useMutation({
    mutationFn: () => payFn({ data: { id: payment.id, method } }),
    onSuccess: () => {
      toast.success("Betalningen är registrerad", {
        description: "Demoläge – inga pengar har dragits.",
      });
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["my-economy"] });
      void qc.invalidateQueries({ queryKey: ["resident-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Betala</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Betala {kindLabel.toLowerCase()}</DialogTitle>
          <DialogDescription>
            {monthName(payment.period)} · {kr(payment.amount)} · förfaller{" "}
            {dateLong(payment.due_date)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {methods.map((m) => {
            const Icon = m.icon;
            const active = method === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                  active ? "border-primary bg-primary/5" : "border-border hover:bg-surface-muted"
                }`}
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className="block text-xs text-muted-foreground">{m.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          Demoläge: betalningen registreras direkt och inga pengar dras.
        </p>

        {method === "bank" && (
          <div className="rounded-xl border border-border bg-surface-muted p-3 text-xs text-muted-foreground">
            <p>Bankgiro: {bankgiro ?? "–"}</p>
            <p className="mt-1">OCR-nummer: {ocr}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Avbryt
          </Button>
          <Button disabled={pay.isPending} onClick={() => pay.mutate()}>
            {pay.isPending
              ? "Betalar…"
              : method === "bank"
                ? "Jag har betalat"
                : `Betala ${kr(payment.amount)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
