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

const REQUEST_STEPS = [
  { label: "Mottagen", text: "Föreningen har tagit emot din felanmälan." },
  { label: "Påbörjad", text: "Någon är utsedd att åtgärda felet och planerar arbetet." },
  { label: "Åtgärdas", text: "Arbetet med att åtgärda felet pågår." },
  { label: "Klar", text: "Felet är åtgärdat. Hör av dig om något fortfarande inte fungerar." },
];

const STEP_OF_STATUS: Record<string, number> = {
  new: 0,
  received: 0,
  assigned: 1,
  booked: 1,
  in_progress: 2,
  resolved: 3,
  closed: 3,
};

/** Felanmälans status som fyra enkla steg: Mottagen → Påbörjad → Åtgärdas → Klar. */
export function RequestProgress({ status, compact }: { status: string; compact?: boolean }) {
  const current = STEP_OF_STATUS[status] ?? 0;
  return (
    <div>
      <ol className="grid grid-cols-4 gap-1.5" aria-label="Status för felanmälan">
        {REQUEST_STEPS.map((step, i) => {
          const done = i <= current;
          return (
            <li key={step.label} aria-current={i === current ? "step" : undefined}>
              <span
                className={cn(
                  "block h-2 rounded-full",
                  done ? (current === 3 ? "bg-success" : "bg-primary") : "bg-muted",
                )}
              />
              <span
                className={cn(
                  "mt-1.5 block text-xs sm:text-sm",
                  i === current ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      {compact ? null : <p className="mt-3 text-base">{REQUEST_STEPS[current]?.text}</p>}
    </div>
  );
}

/** Status i boendets vy: samma fyra steg som stegvisaren. */
export function ResidentRequestStatus({ status }: { status: string }) {
  const step = STEP_OF_STATUS[status] ?? 0;
  const tone: Tone = step === 3 ? "success" : step === 0 ? "info" : "warning";
  return <StatusPill tone={tone}>{REQUEST_STEPS[step]?.label}</StatusPill>;
}
