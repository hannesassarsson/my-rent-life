import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ImageUp, Loader2, Palette, Type } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { updateBranding } from "@/lib/app.functions";
import { brandCssVars, brandTheme, normalizeHex, paletteFromImage } from "@/lib/brand-colors";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import {
  BRAND_BUCKET,
  LOGO_TYPES,
  MAX_LOGO_BYTES,
  brandLogoUrl,
  type OrgBrand,
} from "@/lib/org-brand";
import { OrgBrandMark, PoweredBy } from "@/components/org-brand";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoMark } from "@/components/brand";

/** Boendeplattformens egen blå, som startvärde när ingen färg är vald. */
const DEFAULT_COLOR = "#1d4f91";

type Mode = OrgBrand["mode"];

const MODES: { value: Mode; title: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "platform",
    title: "Standard",
    description: "Boendeplattformens logga och färger",
    icon: <LogoMark className="size-6" />,
  },
  {
    value: "logo",
    title: "Egen logga",
    description: "Ladda upp er logga, vi hämtar färgerna",
    icon: <ImageUp className="size-6 text-primary" />,
  },
  {
    value: "text",
    title: "Namn som text",
    description: "Ert namn i er färg, utan bild",
    icon: <Type className="size-6 text-primary" />,
  },
];

export type BrandingOrg = {
  id: string;
  name: string;
  brand_mode: string;
  brand_name: string | null;
  brand_logo_path: string | null;
  brand_color: string | null;
};

export function BrandingEditor({ org }: { org: BrandingOrg }) {
  const saveFn = useServerFn(updateBranding);
  const qc = useQueryClient();
  const initial = {
    mode: (org.brand_mode as Mode) ?? "platform",
    name: org.brand_name ?? org.name,
    logoPath: org.brand_logo_path,
    color: org.brand_color ?? DEFAULT_COLOR,
  };
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [name, setName] = useState(initial.name);
  const [logoPath, setLogoPath] = useState<string | null>(initial.logoPath);
  const [color, setColor] = useState(initial.color);
  const [hexInput, setHexInput] = useState(initial.color);
  const [palette, setPalette] = useState<string[]>([]);
  const [busy, setBusy] = useState<"idle" | "uploading" | "analyzing">("idle");
  // Loggor som laddats upp men inte sparats tas bort när man sparar.
  const uploaded = useRef<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  // Färgerna i en redan sparad logga visas som förslag.
  useEffect(() => {
    if (!initial.logoPath) return;
    let cancelled = false;
    paletteFromImage(brandLogoUrl(initial.logoPath))
      .then((p) => !cancelled && setPalette(p))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initial.logoPath]);

  function pickColor(hex: string) {
    setColor(hex);
    setHexInput(hex);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      toast.error("Loggan behöver vara en PNG-, JPG- eller WebP-bild.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("Loggan är större än 1 MB. Spara den i en mindre storlek och försök igen.");
      return;
    }
    const local = URL.createObjectURL(file);
    try {
      setBusy("analyzing");
      const colors = await paletteFromImage(local).catch(() => [] as string[]);
      setPalette(colors);
      if (colors[0]) pickColor(colors[0]);

      setBusy("uploading");
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${org.id}/logo-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(BRAND_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
      if (error) throw new Error("Loggan kunde inte laddas upp. Försök igen om en stund.");
      uploaded.current.push(path);
      setLogoPath(path);
      setMode("logo");
      toast.success(
        colors.length > 0
          ? "Loggan är uppladdad och färgerna är hämtade"
          : "Loggan är uppladdad. Välj en färg nedan.",
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      URL.revokeObjectURL(local);
      setBusy("idle");
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const changed =
    mode !== initial.mode ||
    name.trim() !== initial.name ||
    logoPath !== initial.logoPath ||
    color !== initial.color;

  const save = useMutation({
    mutationFn: () => saveFn({ data: { mode, name: name.trim(), logoPath, color } }),
    onSuccess: async () => {
      // Städa bort loggor som inte längre används.
      const unused = [...uploaded.current, ...(initial.logoPath ? [initial.logoPath] : [])].filter(
        (p) => p !== logoPath,
      );
      uploaded.current = [];
      if (unused.length > 0) await supabase.storage.from(BRAND_BUCKET).remove(unused);
      toast.success(
        mode === "platform"
          ? "Boendeplattformens utseende används igen"
          : "Ert varumärke är sparat",
      );
      void qc.invalidateQueries({ queryKey: ["admin-settings"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const preview: OrgBrand = { mode, name: name.trim() || org.name, logoPath, color };
  const own = mode !== "platform";
  const theme = brandTheme(color);
  const missing =
    mode === "logo" && !logoPath
      ? "Ladda upp en logga för att kunna spara."
      : mode === "text" && !name.trim()
        ? "Skriv namnet som ska visas."
        : null;

  return (
    <Panel
      title="Ert varumärke"
      description="Visa appen med er logga eller ert namn och i era färger. Boende och personal ser det när de loggar in, och det syns på inbjudningarna."
      className="xl:col-span-2"
    >
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <fieldset>
            <legend className="mb-3 text-base font-medium">Hur ska appen se ut?</legend>
            <div className="grid gap-3 sm:grid-cols-3" role="radiogroup">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.value}
                  onClick={() => setMode(m.value)}
                  className={cn(
                    "flex min-h-24 flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-colors",
                    mode === m.value
                      ? "border-primary bg-primary-soft ring-1 ring-primary"
                      : "border-border hover:bg-surface-muted",
                  )}
                >
                  <span className="flex w-full items-center justify-between">
                    {m.icon}
                    {mode === m.value ? <Check className="size-5 text-primary" /> : null}
                  </span>
                  <span className="text-base font-medium">{m.title}</span>
                  <span className="text-sm text-muted-foreground">{m.description}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {mode === "logo" ? (
            <div className="space-y-3">
              <Label className="text-base">Logga</Label>
              <div className="flex flex-wrap items-center gap-4">
                {logoPath ? (
                  <span className="grid h-16 min-w-32 place-items-center rounded-lg border border-border bg-surface px-3">
                    <img
                      src={brandLogoUrl(logoPath)}
                      alt="Er logga"
                      className="max-h-12 w-auto max-w-[200px] object-contain"
                    />
                  </span>
                ) : null}
                <input
                  ref={fileInput}
                  type="file"
                  accept={LOGO_TYPES.join(",")}
                  className="sr-only"
                  id="logo-file"
                  onChange={(e) => void onFile(e.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant={logoPath ? "outline" : "default"}
                  size="lg"
                  disabled={busy !== "idle"}
                  onClick={() => fileInput.current?.click()}
                >
                  {busy !== "idle" ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <ImageUp className="size-5" />
                  )}
                  {busy === "analyzing"
                    ? "Hämtar färger…"
                    : busy === "uploading"
                      ? "Laddar upp…"
                      : logoPath
                        ? "Byt logga"
                        : "Ladda upp logga"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                PNG, JPG eller WebP, högst 1 MB. Bäst blir en liggande logga med genomskinlig eller
                vit bakgrund.
              </p>
            </div>
          ) : null}

          {mode === "text" ? (
            <div className="space-y-2">
              <Label htmlFor="brand-name" className="text-base">
                Namn som visas
              </Label>
              <Input
                id="brand-name"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                className="h-11 text-base"
              />
              <p className="text-sm text-muted-foreground">
                Visas överst i appen i stället för en logga, t.ex. förvaltarens eller föreningens
                namn.
              </p>
            </div>
          ) : null}

          {own ? (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-base font-medium">
                <Palette className="size-5 text-primary" /> Färg
              </p>
              {palette.length > 0 ? (
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">Färger i loggan</p>
                  <div className="flex flex-wrap gap-2">
                    {palette.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => pickColor(hex)}
                        aria-label={`Välj färgen ${hex}`}
                        aria-pressed={color === hex}
                        className={cn(
                          "grid size-11 place-items-center rounded-full border border-border shadow-sm",
                          color === hex && "ring-2 ring-foreground ring-offset-2",
                        )}
                        style={{ backgroundColor: hex }}
                      >
                        {color === hex ? (
                          <Check
                            className="size-5"
                            style={{ color: brandTheme(hex).adjusted ? "#000" : "#fff" }}
                          />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor="brand-color-picker" className="text-sm text-muted-foreground">
                    Egen färg
                  </Label>
                  <input
                    id="brand-color-picker"
                    type="color"
                    value={color}
                    onChange={(e) => pickColor(e.target.value)}
                    className="h-11 w-16 cursor-pointer rounded-lg border border-border bg-surface p-1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand-color-hex" className="text-sm text-muted-foreground">
                    Färgkod
                  </Label>
                  <Input
                    id="brand-color-hex"
                    value={hexInput}
                    onChange={(e) => {
                      setHexInput(e.target.value);
                      const hex = normalizeHex(e.target.value);
                      if (hex) setColor(hex);
                    }}
                    placeholder="#d51c29"
                    className="h-11 w-32 font-mono text-base"
                  />
                </div>
              </div>
              {theme.adjusted ? (
                <p className="text-sm text-muted-foreground" role="status">
                  Färgen är ljus, så knappar och länkar får en något mörkare nyans (
                  <span className="font-mono">{theme.primary}</span>) för att texten ska vara lätt
                  att läsa.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
            <Button
              type="button"
              size="lg"
              disabled={!changed || !!missing || save.isPending || busy !== "idle"}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Sparar…" : "Spara varumärke"}
            </Button>
            {missing ? <p className="text-sm text-muted-foreground">{missing}</p> : null}
          </div>
        </div>

        <BrandPreview brand={preview} orgName={org.name} />
      </div>
    </Panel>
  );
}

/** Så här ser appen ut för de boende med det valda varumärket. */
function BrandPreview({ brand, orgName }: { brand: OrgBrand; orgName: string }) {
  const own = brand.mode !== "platform";
  const style = own && brand.color ? (brandCssVars(brand.color) as React.CSSProperties) : undefined;
  return (
    <div>
      <p className="mb-3 text-base font-medium">Förhandsvisning</p>
      <div
        style={style}
        className="overflow-hidden rounded-xl border border-border bg-background shadow-sm"
        aria-label="Förhandsvisning av appen"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
          {brand.mode === "logo" && !brand.logoPath ? (
            <span className="grid h-9 w-32 place-items-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
              Er logga
            </span>
          ) : (
            <OrgBrandMark brand={brand} orgName={orgName} />
          )}
          <span className="text-xs text-muted-foreground">Mitt boende</span>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-[140px_1fr]">
          <ul className="space-y-1 text-sm">
            <li className="rounded-lg bg-sidebar-accent px-3 py-2 font-semibold text-sidebar-accent-foreground">
              Hem
            </li>
            <li className="px-3 py-2 text-foreground/80">Felanmälan</li>
            <li className="px-3 py-2 text-foreground/80">Boka</li>
          </ul>
          <div className="space-y-3">
            <p className="text-base font-semibold">Välkommen hem, Anna</p>
            <p className="flex items-center gap-2 text-sm">
              Element i sovrum
              <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                Mottagen
              </span>
            </p>
            <Button type="button" size="sm" tabIndex={-1}>
              Gör en felanmälan
            </Button>
            <p className="text-sm">
              <span className="font-medium text-primary underline underline-offset-4">
                Läs föreningens nyheter
              </span>
            </p>
          </div>
        </div>
        {own ? <PoweredBy className="border-t border-border px-4 py-2.5" /> : null}
      </div>
    </div>
  );
}
