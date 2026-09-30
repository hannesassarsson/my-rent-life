import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { brandCssVars } from "@/lib/brand-colors";

export const BRAND_BUCKET = "branding";
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_LOGO_BYTES = 1024 * 1024;

export type OrgBrand = {
  mode: "platform" | "logo" | "text";
  name: string | null;
  logoPath: string | null;
  color: string | null;
};

/** Loggorna ligger i en publik bucket; adressen räknas fram utan anrop. */
export function brandLogoUrl(path: string) {
  return supabase.storage.from(BRAND_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Om organisationen visas i eget varumärke i stället för Boendeplattformens. */
export function isOwnBrand(brand: OrgBrand | null | undefined): brand is OrgBrand {
  return !!brand && brand.mode !== "platform";
}

/**
 * Lägger föreningens färger på hela sidan medan komponenten visas, så att
 * även dialoger och menyer (som ritas utanför skalet) får rätt färg.
 */
export function useBrandTheme(brand: OrgBrand | null | undefined) {
  const color = isOwnBrand(brand) ? brand.color : null;
  useEffect(() => {
    if (!color) return;
    const root = document.documentElement;
    const vars = brandCssVars(color);
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    return () => {
      for (const k of Object.keys(vars)) root.style.removeProperty(k);
    };
  }, [color]);
}
