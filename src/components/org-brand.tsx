import { brandLogoUrl, type OrgBrand } from "@/lib/org-brand";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand";

/** Organisationens logga eller namn; Boendeplattformens logga som standard. */
export function OrgBrandMark({
  brand,
  orgName,
  className,
}: {
  brand: OrgBrand | null | undefined;
  orgName: string | null | undefined;
  className?: string;
}) {
  if (brand?.mode === "logo" && brand.logoPath) {
    return (
      <img
        src={brandLogoUrl(brand.logoPath)}
        alt={brand.name || orgName || "Logga"}
        className={cn("h-9 w-auto max-w-[180px] object-contain object-left", className)}
      />
    );
  }
  if (brand?.mode === "text" && brand.name) {
    return (
      <span
        className={cn(
          "block max-w-[200px] truncate text-lg leading-tight font-bold tracking-tight text-primary",
          className,
        )}
      >
        {brand.name}
      </span>
    );
  }
  return <Logo {...(className ? { className } : {})} />;
}

/** Diskret rad som visar att tjänsten levereras av Boendeplattformen. */
export function PoweredBy({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Drivs med <span className="font-medium text-foreground/80">Boendeplattformen</span>
    </p>
  );
}
