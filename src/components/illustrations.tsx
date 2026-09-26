// Illustrationer i varumärkets stil: djupblå hus med fönster som tänds,
// grönska och NFC-vågor. Ritade som SVG med färgtokens, så att de följer
// temat och är skarpa i alla storlekar. Rörelsen stängs av för den som
// valt minskad rörelse (se styles.css).

import { cn } from "@/lib/utils";

/** Deterministisk "slump", så att server och klient ritar samma sak. */
function seeded(n: number) {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

type WindowGridProps = {
  x: number;
  y: number;
  cols: number;
  rows: number;
  w?: number;
  h?: number;
  gapX?: number;
  gapY?: number;
  seed: number;
  /** Andel fönster som kan tändas */
  lit?: number;
};

/** Ett rutnät av fönster där några tänds och släcks i otakt. */
function WindowGrid({
  x,
  y,
  cols,
  rows,
  w = 10,
  h = 12,
  gapX = 8,
  gapY = 10,
  seed,
  lit = 0.35,
}: WindowGridProps) {
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = seed * 100 + r * cols + c;
      const cx = x + c * (w + gapX);
      const cy = y + r * (h + gapY);
      const on = seeded(i) < lit;
      cells.push(
        <g key={`${r}-${c}`}>
          <rect x={cx} y={cy} width={w} height={h} rx={1.5} className="fill-navy-soft/35" />
          {on ? (
            <rect
              x={cx}
              y={cy}
              width={w}
              height={h}
              rx={1.5}
              className="animate-window fill-glow"
              style={{ animationDelay: `${(seeded(i + 7) * 7).toFixed(2)}s` }}
            />
          ) : null}
        </g>,
      );
    }
  }
  return <g>{cells}</g>;
}

function Tree({ x, y, r = 16 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <rect x={x - 2} y={y} width={4} height={r * 1.1} rx={2} className="fill-navy/60" />
      <circle cx={x} cy={y - r * 0.2} r={r} className="fill-leaf" />
      <circle cx={x - r * 0.45} cy={y + r * 0.15} r={r * 0.7} className="fill-leaf/80" />
    </g>
  );
}

/** Hero: ett kvarter med tre hus, där mitthuset har loggans form. */
export function NeighborhoodScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 560 420"
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label="Illustration av ett bostadskvarter där fönster tänds"
    >
      <rect width="560" height="420" rx="32" className="fill-primary-soft" />
      <circle cx="455" cy="92" r="42" className="fill-glow-soft" />
      <circle cx="455" cy="92" r="24" className="fill-glow/70" />
      <rect x="70" y="70" width="90" height="18" rx="9" className="fill-surface/80" />
      <rect x="100" y="54" width="60" height="18" rx="9" className="fill-surface/80" />
      <rect x="300" y="48" width="70" height="14" rx="7" className="fill-surface/70" />

      {/* Vänster hus: lamellhus */}
      <rect x="40" y="170" width="150" height="210" rx="6" className="fill-navy/85" />
      <rect x="40" y="162" width="150" height="14" rx="4" className="fill-navy" />
      <WindowGrid x={56} y={188} cols={6} rows={7} w={11} h={13} gapX={10} gapY={12} seed={1} />

      {/* Mitthus: loggans form med sadeltak */}
      <path d="M200 190 L290 118 a6 6 0 0 1 8 0 L388 190 V380 H200 Z" className="fill-navy" />
      <WindowGrid
        x={222}
        y={202}
        cols={4}
        rows={6}
        w={24}
        h={20}
        gapX={16}
        gapY={12}
        seed={2}
        lit={0.45}
      />
      <rect x="276" y="340" width="36" height="40" rx="4" className="fill-primary" />
      <circle cx="305" cy="361" r="2" className="fill-glow" />

      {/* Höger hus */}
      <rect x="398" y="210" width="126" height="170" rx="6" className="fill-navy/75" />
      <rect x="398" y="202" width="126" height="14" rx="4" className="fill-navy/90" />
      <WindowGrid x={414} y={228} cols={5} rows={5} w={11} h={13} gapX={10} gapY={14} seed={3} />

      {/* Mark och grönska */}
      <rect x="0" y="376" width="560" height="44" rx="0" className="fill-leaf/25" />
      <path
        d="M0 380 H560 V388 a32 32 0 0 1 -32 32 H32 a32 32 0 0 1 -32 -32 Z"
        className="fill-leaf/30"
      />
      <Tree x={30} y={352} r={18} />
      <Tree x={196} y={356} r={14} />
      <Tree x={396} y={354} r={15} />
      <Tree x={540} y={350} r={19} />
    </svg>
  );
}

/** Mobil med NFC-vågor mot en läsare vid en dörr. */
export function KeyScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 360"
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label="Illustration: en mobil hålls mot en NFC-läsare och dörren öppnas"
    >
      <rect width="480" height="360" rx="28" className="fill-primary-soft" />
      {/* Fasad och dörr */}
      <rect x="60" y="40" width="250" height="300" rx="8" className="fill-navy" />
      <WindowGrid
        x={80}
        y={60}
        cols={4}
        rows={2}
        w={30}
        h={24}
        gapX={28}
        gapY={18}
        seed={5}
        lit={0.5}
      />
      <rect x="120" y="170" width="120" height="170" rx="6" className="fill-primary" />
      <rect x="132" y="182" width="96" height="70" rx="4" className="fill-glow-soft/80" />
      <rect x="132" y="262" width="96" height="66" rx="4" className="fill-navy/40" />
      <rect x="214" y="270" width="6" height="26" rx="3" className="fill-glow" />

      {/* Läsare */}
      <rect x="258" y="226" width="34" height="52" rx="8" className="fill-surface" />
      <circle cx="275" cy="244" r="7" className="fill-leaf" />
      <rect x="266" y="260" width="18" height="4" rx="2" className="fill-navy/30" />

      {/* NFC-vågor */}
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M${306 + i * 16} ${226 - i * 10} q ${14 + i * 4} ${26 + i * 10} 0 ${52 + i * 20}`}
          className="animate-nfc fill-none stroke-glow"
          strokeWidth={4}
          strokeLinecap="round"
          style={{ animationDelay: `${i * 0.3}s` }}
        />
      ))}

      {/* Mobil */}
      <g className="animate-float">
        <rect x="350" y="170" width="84" height="150" rx="16" className="fill-foreground" />
        <rect x="356" y="178" width="72" height="134" rx="11" className="fill-surface" />
        <rect x="364" y="192" width="56" height="56" rx="12" className="fill-leaf" />
        <path
          d="M380 220 l8 8 l16 -18"
          className="fill-none stroke-primary-foreground"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="366" y="260" width="52" height="7" rx="3.5" className="fill-navy/70" />
        <rect x="372" y="274" width="40" height="6" rx="3" className="fill-navy/30" />
      </g>
    </svg>
  );
}

/** Små bilder till målgrupperna. */
export function AudienceArt({
  kind,
  className,
}: {
  kind: "resident" | "board" | "owner";
  className?: string;
}) {
  return (
    <svg viewBox="0 0 160 96" className={cn("h-auto w-full", className)} aria-hidden="true">
      <rect width="160" height="96" rx="16" className="fill-primary-soft" />
      {kind === "resident" ? (
        <>
          <path d="M28 52 L56 30 L84 52 V86 H28 Z" className="fill-navy" />
          <rect x="38" y="58" width="12" height="12" rx="2" className="fill-glow" />
          <rect x="62" y="58" width="12" height="12" rx="2" className="fill-navy-soft/40" />
          <g className="animate-float">
            <rect x="100" y="18" width="36" height="64" rx="8" className="fill-foreground" />
            <rect x="104" y="23" width="28" height="54" rx="5" className="fill-surface" />
            <rect x="108" y="30" width="20" height="6" rx="3" className="fill-primary" />
            <rect x="108" y="41" width="20" height="4" rx="2" className="fill-navy/30" />
            <rect x="108" y="49" width="14" height="4" rx="2" className="fill-navy/30" />
            <circle cx="118" cy="66" r="5" className="fill-leaf" />
          </g>
        </>
      ) : kind === "board" ? (
        <>
          <rect x="30" y="18" width="60" height="68" rx="6" className="fill-surface" />
          <rect x="40" y="28" width="30" height="6" rx="3" className="fill-primary" />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <circle
                cx="44"
                cy={48 + i * 12}
                r="3.5"
                className={i === 2 ? "fill-navy-soft" : "fill-leaf"}
              />
              <rect x="52" y={46 + i * 12} width="28" height="4" rx="2" className="fill-navy/30" />
            </g>
          ))}
          <circle cx="112" cy="40" r="10" className="fill-navy" />
          <path d="M96 76 a16 16 0 0 1 32 0 Z" className="fill-navy" />
          <circle cx="134" cy="48" r="8" className="fill-primary" />
          <path d="M122 80 a12 12 0 0 1 24 0 Z" className="fill-primary" />
          <circle cx="112" cy="18" r="5" className="animate-window fill-glow" />
        </>
      ) : (
        <>
          <rect x="18" y="40" width="34" height="46" rx="3" className="fill-navy/70" />
          <path d="M58 44 L84 24 L110 44 V86 H58 Z" className="fill-navy" />
          <rect x="116" y="32" width="28" height="54" rx="3" className="fill-navy/85" />
          <WindowGrid
            x={24}
            y={48}
            cols={2}
            rows={3}
            w={8}
            h={8}
            gapX={6}
            gapY={6}
            seed={7}
            lit={0.5}
          />
          <WindowGrid
            x={68}
            y={50}
            cols={3}
            rows={3}
            w={8}
            h={8}
            gapX={7}
            gapY={6}
            seed={8}
            lit={0.5}
          />
          <WindowGrid
            x={122}
            y={40}
            cols={2}
            rows={4}
            w={6}
            h={7}
            gapX={4}
            gapY={6}
            seed={9}
            lit={0.5}
          />
        </>
      )}
    </svg>
  );
}

/** Stadssiluett längst ner på sidan. */
export function Skyline({ className }: { className?: string }) {
  const blocks = [
    { x: 0, w: 90, h: 70 },
    { x: 96, w: 60, h: 110 },
    { x: 162, w: 120, h: 84, roof: true },
    { x: 288, w: 70, h: 130 },
    { x: 364, w: 110, h: 76 },
    { x: 480, w: 64, h: 100 },
    { x: 550, w: 130, h: 92, roof: true },
    { x: 686, w: 80, h: 120 },
    { x: 772, w: 100, h: 72 },
    { x: 878, w: 70, h: 104 },
    { x: 954, w: 126, h: 86, roof: true },
    { x: 1086, w: 114, h: 116 },
  ];
  return (
    <svg
      viewBox="0 0 1200 150"
      preserveAspectRatio="xMidYMax slice"
      className={cn("h-32 w-full sm:h-40", className)}
      aria-hidden="true"
    >
      {blocks.map((b, i) => {
        const top = 150 - b.h;
        return (
          <g key={i}>
            {b.roof ? (
              <path
                d={`M${b.x} ${top + 18} L${b.x + b.w / 2} ${top - 8} L${b.x + b.w} ${top + 18} V150 H${b.x} Z`}
                className="fill-navy"
              />
            ) : (
              <rect x={b.x} y={top} width={b.w} height={b.h} rx={3} className="fill-navy/90" />
            )}
            <WindowGrid
              x={b.x + 10}
              y={top + (b.roof ? 26 : 12)}
              cols={Math.max(1, Math.floor((b.w - 14) / 16))}
              rows={Math.max(1, Math.floor((b.h - 24) / 20))}
              w={8}
              h={10}
              gapX={8}
              gapY={10}
              seed={20 + i}
              lit={0.3}
            />
          </g>
        );
      })}
    </svg>
  );
}
