import { CheckCircle2, Nfc, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export type KeyCardState = "idle" | "working" | "granted" | "denied";

/**
 * Mobilnyckeln: visar vad som händer när telefonen hålls mot läsaren.
 */
export function KeyCard({
  name,
  subtitle,
  state,
  message,
}: {
  name: string;
  subtitle: string;
  state: KeyCardState;
  message?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl p-6 text-white shadow-[var(--shadow-lift)] transition-colors duration-500",
        state === "granted"
          ? "bg-[oklch(0.55_0.15_150)]"
          : state === "denied"
            ? "bg-[oklch(0.55_0.18_25)]"
            : "bg-[oklch(0.32_0.06_260)]",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-wide uppercase opacity-70">Mobilnyckel</p>
          <p className="mt-1 text-lg font-semibold">{name}</p>
          <p className="text-sm opacity-80">{subtitle}</p>
        </div>
        <span className="relative grid size-14 place-items-center">
          {state === "idle" || state === "working" ? (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
              <span className="absolute inset-2 rounded-full bg-white/15" />
              <Nfc className="relative size-7" />
            </>
          ) : state === "granted" ? (
            <CheckCircle2 className="size-10" />
          ) : (
            <XCircle className="size-10" />
          )}
        </span>
      </div>
      <p className="mt-8 text-sm font-medium" aria-live="polite">
        {state === "idle"
          ? "Håll telefonen mot läsaren vid dörren"
          : state === "working"
            ? "Kontrollerar behörighet…"
            : message}
      </p>
    </div>
  );
}
