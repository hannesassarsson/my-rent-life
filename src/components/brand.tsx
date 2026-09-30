import { cn } from "@/lib/utils";

/**
 * Märket: ett hus med ett tänt fönster – hemmet, i en blå ruta. Samma form
 * används som favicon (public/favicon.svg) och går igen i illustrationerna.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-8", className)} aria-hidden="true">
      <rect width="40" height="40" rx="11" className="fill-primary" />
      <path
        d="M9.5 18.6 19.2 10.4a1.2 1.2 0 0 1 1.6 0l9.7 8.2v11.9a1.5 1.5 0 0 1-1.5 1.5h-18a1.5 1.5 0 0 1-1.5-1.5Z"
        className="fill-primary-foreground"
      />
      <rect x="13.2" y="19.6" width="4" height="4" rx="0.9" className="fill-primary" />
      <rect x="22.8" y="19.6" width="4" height="4" rx="0.9" className="fill-glow" />
      <rect x="13.2" y="25.6" width="4" height="4" rx="0.9" className="fill-primary" />
      <rect x="22.8" y="25.6" width="4" height="4" rx="0.9" className="fill-primary" />
    </svg>
  );
}

export function Logo({
  className,
  inverted = false,
}: {
  className?: string;
  /** Ljus text för mörk bakgrund */
  inverted?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span
        className={cn("text-[0.95rem] tracking-tight", inverted ? "text-white" : "text-foreground")}
      >
        <span className="font-semibold">Boende</span>
        <span className="font-normal opacity-70">plattformen</span>
      </span>
    </span>
  );
}
