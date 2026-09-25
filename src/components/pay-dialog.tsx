import { useState } from "react";
import { Banknote, CreditCard, Smartphone } from "lucide-react";
import { toast } from "sonner";

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

export type PayMethod = "stripe" | "swish" | "bank";

const methods: {
  id: PayMethod;
  label: string;
  description: string;
  icon: typeof CreditCard;
}[] = [
  {
    id: "stripe",
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
}: {
  payment: { id: string; amount: number | string; period: string; due_date: string };
  kindLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PayMethod>("stripe");

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

        {method === "bank" && (
          <div className="rounded-xl border border-border bg-surface-muted p-3 text-xs text-muted-foreground">
            <p>Bankgiro: 123-4567</p>
            <p className="mt-1">OCR-nummer: visas när betaltjänsten är aktiverad.</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Avbryt
          </Button>
          <Button
            onClick={() => {
              toast.info("Betaltjänsten är inte aktiverad ännu", {
                description: "Skalet är på plats – vi kopplar in betalningarna i nästa steg.",
              });
              setOpen(false);
            }}
          >
            Fortsätt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
