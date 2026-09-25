import { cn } from "@/lib/utils";
import {
  inspectionResultLabels,
  priorityLabels,
  requestStatusLabels,
  projectStatusLabels,
} from "@/lib/format";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const toneClasses: Record<Tone, string> = {
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning-foreground border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/20",
  info: "bg-info-soft text-info border-info/20",
  neutral: "bg-muted text-muted-foreground border-border",
};

const dotClasses: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-muted-foreground/50",
};

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotClasses[tone])} />
      {children}
    </span>
  );
}

const requestTone: Record<string, Tone> = {
  new: "info",
  received: "info",
  assigned: "info",
  booked: "warning",
  in_progress: "warning",
  resolved: "success",
  closed: "neutral",
};

export function RequestStatusBadge({ status }: { status: string }) {
  return (
    <StatusPill tone={requestTone[status] ?? "neutral"}>
      {requestStatusLabels[status] ?? status}
    </StatusPill>
  );
}

const priorityTone: Record<string, Tone> = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "danger",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <StatusPill tone={priorityTone[priority] ?? "neutral"}>
      {priorityLabels[priority] ?? priority}
    </StatusPill>
  );
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return (
    <StatusPill tone={status === "paid" ? "success" : "warning"}>
      {status === "paid" ? "Betald" : "Obetald"}
    </StatusPill>
  );
}

export function ProjectStatusBadge({ status }: { status: string }) {
  const tone: Tone = status === "done" ? "success" : status === "in_progress" ? "warning" : "info";
  return <StatusPill tone={tone}>{projectStatusLabels[status] ?? status}</StatusPill>;
}

const inspectionResultTones: Record<string, Tone> = {
  approved: "success",
  remarks: "warning",
  failed: "danger",
};

/** Status för en besiktning: planerad, inställd eller resultatet. */
export function InspectionStatusPill({
  status,
  result,
}: {
  status: string;
  result: string | null;
}) {
  if (status === "cancelled") return <StatusPill tone="neutral">Inställd</StatusPill>;
  if (status !== "completed") return <StatusPill tone="info">Planerad</StatusPill>;
  const label =
    inspectionResultLabels[result as keyof typeof inspectionResultLabels] ?? "Genomförd";
  return <StatusPill tone={inspectionResultTones[result ?? ""] ?? "neutral"}>{label}</StatusPill>;
}

const deliveryTone: Record<string, Tone> = {
  pending: "info",
  sending: "info",
  sent: "success",
  failed: "danger",
  skipped: "neutral",
};

export const deliveryStatusLabels: Record<string, string> = {
  pending: "I kö",
  sending: "Skickas",
  sent: "Skickat",
  failed: "Misslyckades",
  skipped: "Skickades inte",
};

export function DeliveryStatusPill({ status }: { status: string }) {
  return (
    <StatusPill tone={deliveryTone[status] ?? "neutral"}>
      {deliveryStatusLabels[status] ?? status}
    </StatusPill>
  );
}
