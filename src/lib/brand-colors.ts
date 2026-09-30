// Färger för föreningens eget varumärke. Allt räknas i sRGB med WCAG:s
// kontrastformel, så att en vald färg alltid justeras till en nyans där text
// på knappar och länkar går att läsa (minst 4,5:1).

type Rgb = [number, number, number];

export const HEX_RE = /^#[0-9a-f]{6}$/;

export function normalizeHex(value: string): string | null {
  const v = value.trim().toLowerCase();
  const short = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const long = /^#?([0-9a-f]{6})$/.exec(v);
  return long ? `#${long[1]}` : null;
}

function toRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((c) =>
      Math.round(Math.min(255, Math.max(0, c)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function luminance([r, g, b]: Rgb) {
  const ch = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrast(a: string, b: string) {
  const la = luminance(toRgb(a));
  const lb = luminance(toRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Blandar a med b; t = 0 ger a, t = 1 ger b. */
export function mix(a: string, b: string, t: number) {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * t) as Rgb);
}

/** Mörkar färgen stegvis tills den har minst `ratio` i kontrast mot `against`. */
export function darkenFor(color: string, against: string, ratio = 4.5) {
  let c = color;
  for (let i = 0; i < 40 && contrast(c, against) < ratio; i++) c = mix(c, "#000000", 0.05);
  return c;
}

/** Ljus färg som närmar sig vitt. För svaga färger, som ljusgult, blir den ändå läsbar. */
function tint(color: string, amount: number) {
  return mix(color, "#ffffff", amount);
}

export type BrandTheme = {
  /** Knappar och länkar: den valda färgen, mörkad vid behov för vit text. */
  primary: string;
  /** Ljus bakgrund för markeringar och etiketter. */
  soft: string;
  /** Text på den ljusa bakgrunden. */
  onSoft: string;
  /** Om färgen behövde justeras för att bli läsbar. */
  adjusted: boolean;
};

export function brandTheme(color: string): BrandTheme {
  const primary = darkenFor(color, "#ffffff", 4.5);
  const soft = tint(color, 0.9);
  const onSoft = darkenFor(primary, soft, 4.5);
  return { primary, soft, onSoft, adjusted: primary !== color };
}

/** CSS-variablerna i appens tema som byts ut mot föreningens färg. */
export function brandCssVars(color: string): Record<string, string> {
  const t = brandTheme(color);
  return {
    "--primary": t.primary,
    "--primary-foreground": "#ffffff",
    "--primary-soft": t.soft,
    "--ring": t.primary,
    "--accent": t.soft,
    "--accent-foreground": t.onSoft,
    "--sidebar-primary": t.primary,
    "--sidebar-primary-foreground": "#ffffff",
    "--sidebar-accent": tint(color, 0.92),
    "--sidebar-accent-foreground": darkenFor(t.primary, tint(color, 0.92), 4.5),
    "--sidebar-ring": t.primary,
    "--chart-1": t.primary,
  };
}

/* ---------------------------- FÄRGANALYS ---------------------------- */

function saturation([r, g, b]: Rgb) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function distance(a: Rgb, b: Rgb) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Hittar loggans tydligaste färger. Genomskinliga och nästan vita pixlar
 * (bakgrund) räknas inte; mättade färger väger tyngre än grått, så att en
 * röd symbol går före svart text. Ger högst `max` väl åtskilda färger.
 */
export function paletteFromPixels(data: Uint8ClampedArray, max = 5): string[] {
  const buckets = new Map<number, { sum: Rgb; n: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const rgb: Rgb = [data[i]!, data[i + 1]!, data[i + 2]!];
    if (data[i + 3]! < 200) continue;
    if (rgb[0] > 238 && rgb[1] > 238 && rgb[2] > 238) continue;
    const key = ((rgb[0] >> 4) << 8) | ((rgb[1] >> 4) << 4) | (rgb[2] >> 4);
    const b = buckets.get(key) ?? { sum: [0, 0, 0] as Rgb, n: 0 };
    b.sum = [b.sum[0] + rgb[0], b.sum[1] + rgb[1], b.sum[2] + rgb[2]];
    b.n++;
    buckets.set(key, b);
  }
  const candidates = [...buckets.values()]
    .map((b) => {
      const avg: Rgb = [b.sum[0] / b.n, b.sum[1] / b.n, b.sum[2] / b.n];
      return { rgb: avg, score: b.n * (0.25 + saturation(avg)) };
    })
    .sort((a, b) => b.score - a.score);
  const picked: Rgb[] = [];
  for (const c of candidates) {
    if (picked.every((p) => distance(p, c.rgb) > 60)) picked.push(c.rgb);
    if (picked.length >= max) break;
  }
  return picked.map(toHex);
}

/** Läser in en bildfil i webbläsaren och returnerar dess tydligaste färger. */
export async function paletteFromImage(src: string, max = 5): Promise<string[]> {
  const img = new Image();
  // Loggor i Storage hämtas från en annan domän; utan CORS går pixlarna inte att läsa.
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = src;
  await img.decode();
  const size = 96;
  const scale = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, w, h);
  return paletteFromPixels(ctx.getImageData(0, 0, w, h).data, max);
}
