import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Hero-animationen på startsidan: ett stiliserat flerbostadshus där
 * felanmälan, bokning, information och meddelanden glider in, samlas runt
 * huset och kopplas ihop med tunna linjer – "allt på ett ställe".
 *
 * Allt ritas i en scen på 720 × 720 enheter som skalas till behållarens
 * bredd. Tidslinjen är en ren funktion av tiden (0–LOOP s) och uppdaterar
 * DOM:en direkt, så React renderar inte om per bildruta. Loopen är sömlös:
 * start- och slutläget är identiska och alla svängningar har hela perioder
 * per varv.
 *
 * - Pausar när den inte syns (IntersectionObserver).
 * - Vid "reducera rörelse" visas en stillbild där allt är samlat.
 * - Under 520 px bredd krymper huset och korten förstoras så att de går att läsa.
 */

const LOOP = 11; // sekunder
const SIZE = 720;
const HOUSE_CX = 382;
const HOUSE_CY = 400;

type Pt = [number, number];
type Layout = { houseScale: number; cardScale: number; out: Pt[]; dock: Pt[] };

const LAYOUTS: Record<"desktop" | "mobile", Layout> = {
  desktop: {
    houseScale: 1,
    cardScale: 1,
    out: [
      [22, 96],
      [522, 80],
      [520, 478],
      [14, 500],
    ],
    dock: [
      [60, 124],
      [486, 118],
      [494, 424],
      [48, 468],
    ],
  },
  mobile: {
    houseScale: 0.84,
    cardScale: 1.3,
    out: [
      [0, 14],
      [428, 70],
      [428, 540],
      [0, 586],
    ],
    dock: [
      [8, 40],
      [412, 96],
      [412, 506],
      [8, 560],
    ],
  },
};

/** Fönstret som varje kort kopplas till. */
const TARGETS = ["L1", "R0", "R4", "L4"];
/** Fönster som alltid lyser svagt, som det tända fönstret i logotypen. */
const BASE_LIT: Record<string, number> = { R2: 0.95, W1b: 0.55 };

type Win = { id: string; x: number; y: number; w: number; h: number };
const WINDOWS: Win[] = [
  ...Array.from({ length: 6 }).flatMap((_, i) => [
    { id: `L${i}`, x: 280, y: 216 + i * 54, w: 48, h: 34 },
    { id: `R${i}`, x: 402, y: 216 + i * 54, w: 48, h: 34 },
  ]),
  ...Array.from({ length: 4 }).flatMap((_, i) => [
    { id: `W${i}a`, x: 482, y: 338 + i * 56, w: 30, h: 32 },
    { id: `W${i}b`, x: 528, y: 338 + i * 56, w: 30, h: 32 },
  ]),
];
const WIN_BY_ID = Object.fromEntries(WINDOWS.map((w) => [w.id, w]));

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const easeOut = (x: number) => 1 - Math.pow(1 - x, 4);
const easeInOut = (x: number) => (x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2);
const easeSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;
const TAU = Math.PI * 2;

export function HeroAnimation({ className }: { className?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const q = <T extends Element>(sel: string) => stage.querySelector<T>(sel)!;
    const inner = q<HTMLDivElement>("[data-inner]");
    const house = q<SVGGElement>("[data-house]");
    const houseP = q<SVGGElement>("[data-house-parallax]");
    const back = q<SVGGElement>("[data-back]");
    const halo = q<SVGCircleElement>("[data-halo]");
    const warm = q<SVGCircleElement>("[data-warm]");
    const ring = q<SVGCircleElement>("[data-ring]");
    const cards = Array.from(stage.querySelectorAll<HTMLDivElement>("[data-card]"));
    const links = Array.from(stage.querySelectorAll<SVGGElement>("[data-link]")).map((g) => ({
      path: g.querySelector("path")!,
      start: g.querySelector<SVGCircleElement>("[data-start]")!,
      end: g.querySelector<SVGCircleElement>("[data-end]")!,
      pulse: g.querySelector<SVGCircleElement>("[data-pulse]")!,
    }));
    const lit = Object.fromEntries(
      Array.from(stage.querySelectorAll<SVGRectElement>("[data-lit]")).map((el) => [
        el.dataset["lit"]!,
        el,
      ]),
    );

    let layout = LAYOUTS.desktop;
    const resize = () => {
      const w = stage.clientWidth;
      inner.style.transform = `scale(${w / SIZE})`;
      layout = w < 520 ? LAYOUTS.mobile : LAYOUTS.desktop;
      const s = layout.houseScale;
      house.setAttribute(
        "transform",
        `translate(${HOUSE_CX} ${HOUSE_CY}) scale(${s}) translate(${-HOUSE_CX} ${-HOUSE_CY})`,
      );
    };
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    resize();
    const housePoint = (x: number, y: number): Pt => [
      HOUSE_CX + (x - HOUSE_CX) * layout.houseScale,
      HOUSE_CY + (y - HOUSE_CY) * layout.houseScale,
    ];

    // Parallax efter muspekaren, bara med mus.
    let px = 0,
      py = 0,
      tx = 0,
      ty = 0;
    const onPointer = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      tx = clamp(((e.clientX - (r.left + r.width / 2)) / r.width) * 2, -1, 1);
      ty = clamp(((e.clientY - (r.top + r.height / 2)) / r.height) * 2, -1, 1);
    };
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (finePointer) window.addEventListener("pointermove", onPointer, { passive: true });

    function render(t: number) {
      const ph = t / LOOP;
      px = lerp(px, tx, 0.06);
      py = lerp(py, ty, 0.06);
      back.setAttribute("transform", `translate(${-px * 6} ${-py * 5})`);
      houseP.setAttribute("transform", `translate(${px * 3} ${py * 2})`);

      const together = easeSine(prog(t, 5.6, 6.8)) * (1 - easeSine(prog(t, 8.5, 9.9)));
      halo.setAttribute("r", String(268 + 10 * together));
      warm.setAttribute("opacity", String(0.75 * together));
      const breathe = 1 + 0.012 * Math.sin(TAU * ph);
      ring.setAttribute("transform", `translate(382 384) scale(${breathe}) translate(-382 -384)`);

      const litNow: Record<string, number> = {};
      cards.forEach((el, i) => {
        const inAt = 0.5 + i * 0.95;
        const pin = easeOut(prog(t, inAt, inAt + 1.4));
        const gather = easeInOut(prog(t, 4.6 + i * 0.12, 6.6 + i * 0.12));
        const outAt = 8.4 + i * 0.14;
        const pout = easeInOut(prog(t, outAt, outAt + 1.3));
        const [ox, oy] = layout.out[i]!;
        const [dx, dy] = layout.dock[i]!;
        const floatY = Math.sin(TAU * ph * 2 + i * 1.7) * 3.2;
        const floatX = Math.cos(TAU * ph + i * 2.1) * 2;
        const dir = i === 0 || i === 3 ? -1 : 1;
        const x = lerp(ox, dx, gather) + floatX + (1 - pin) * 14 * dir + px * 9;
        const y = lerp(oy, dy, gather) + floatY + (1 - pin) * 16 - pout * 10 + py * 7;
        const s = layout.cardScale * (1 - 0.02 * (1 - pin)) * (1 - 0.015 * gather);
        el.style.opacity = (pin * (1 - pout)).toFixed(3);
        el.style.transform = `translate(${x}px,${y}px) scale(${s})`;

        const pill = el.querySelector<HTMLElement>("[data-pill]");
        if (pill) {
          const pp = easeOut(prog(t, inAt + 0.55, inAt + 1.2));
          pill.style.opacity = String(pp);
          pill.style.transform = `translateY(${(1 - pp) * 4}px)`;
        }
        const check = el.querySelector<SVGPathElement>("[data-check]");
        if (check)
          check.style.strokeDashoffset = String(1 - easeOut(prog(t, inAt + 0.8, inAt + 1.35)));
        const dot = el.querySelector<HTMLElement>("[data-dot]");
        if (dot) dot.style.opacity = String(0.55 + 0.45 * Math.sin(TAU * ph * 4) ** 2);

        // Linje från kortets närmaste kant till fönstret.
        const win = WIN_BY_ID[TARGETS[i]!]!;
        const [wx, wy] = housePoint(win.x + win.w / 2, win.y + win.h / 2);
        const cw = el.offsetWidth * s;
        const ch = el.offsetHeight * s;
        const ax = clamp(wx, x + 8, x + cw - 8);
        const ay = clamp(wy, y + 8, y + ch - 8);
        const nx = -(wy - ay);
        const ny = wx - ax;
        const nl = Math.hypot(nx, ny) || 1;
        const bend = 22 * (i % 2 ? 1 : -1);
        const cx = (ax + wx) / 2 + (nx / nl) * bend;
        const cy = (ay + wy) / 2 + (ny / nl) * bend;
        const link = links[i]!;
        link.path.setAttribute("d", `M${ax} ${ay} Q${cx} ${cy} ${wx} ${wy}`);
        const draw =
          easeInOut(prog(t, 5.5 + i * 0.16, 6.6 + i * 0.16)) *
          (1 - easeInOut(prog(t, 8.2 + i * 0.1, 9.1 + i * 0.1)));
        const len = link.path.getTotalLength();
        link.path.setAttribute("stroke-dasharray", `${len} ${len}`);
        link.path.setAttribute("stroke-dashoffset", String(len * (1 - draw)));
        link.start.setAttribute("cx", String(ax));
        link.start.setAttribute("cy", String(ay));
        link.start.setAttribute("opacity", String(draw > 0.01 ? clamp(draw * 4) : 0));
        const endO = clamp((draw - 0.92) / 0.08);
        link.end.setAttribute("cx", String(wx));
        link.end.setAttribute("cy", String(wy));
        link.end.setAttribute("opacity", String(endO * 0.9));
        link.end.setAttribute("r", String(2.2 + 1.2 * endO));
        const pp = prog(t, 6.7 + i * 0.16, 7.9 + i * 0.16);
        if (pp > 0 && pp < 1) {
          const pt = link.path.getPointAtLength(len * easeInOut(pp));
          link.pulse.setAttribute("cx", String(pt.x));
          link.pulse.setAttribute("cy", String(pt.y));
          link.pulse.setAttribute("opacity", String(Math.sin(Math.PI * pp) * 0.9));
        } else link.pulse.setAttribute("opacity", "0");
        litNow[TARGETS[i]!] = clamp((draw - 0.85) / 0.15) * (1 - easeSine(prog(t, 8.6, 9.8)));
      });

      for (const id in lit) {
        const v = Math.max(BASE_LIT[id] ?? 0, litNow[id] ?? 0);
        lit[id]!.setAttribute("opacity", v.toFixed(3));
      }
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      render(7.4); // stillbild: allt samlat runt huset
      return () => {
        ro.disconnect();
        window.removeEventListener("pointermove", onPointer);
      };
    }

    let visible = true;
    let raf = 0;
    const startedAt = performance.now();
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
    });
    io.observe(stage);
    const frame = (now: number) => {
      if (visible) render(((now - startedAt) / 1000) % LOOP);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return (
    <div
      ref={stageRef}
      aria-hidden="true"
      className={cn("relative aspect-square w-full max-w-[720px] select-none", className)}
    >
      <div data-inner className="absolute top-0 left-0 size-[720px] origin-top-left">
        <svg
          viewBox="0 0 720 720"
          className="absolute top-0 left-0 size-[720px] overflow-visible"
          fill="none"
        >
          <defs>
            <radialGradient id="hero-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="var(--primary-soft)" stopOpacity="1" />
              <stop offset=".72" stopColor="var(--primary-soft)" stopOpacity=".55" />
              <stop offset="1" stopColor="var(--primary-soft)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="hero-warm" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="var(--glow-soft)" stopOpacity=".9" />
              <stop offset="1" stopColor="var(--glow-soft)" stopOpacity="0" />
            </radialGradient>
            <filter id="hero-soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="10" />
            </filter>
            <linearGradient id="hero-glass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="oklch(0.93 0.03 252)" />
              <stop offset="1" stopColor="oklch(0.89 0.035 252)" />
            </linearGradient>
          </defs>

          <g data-back>
            <circle data-halo cx="382" cy="384" r="268" fill="url(#hero-halo)" />
            <circle data-warm cx="382" cy="330" r="190" fill="url(#hero-warm)" opacity="0" />
            <circle
              data-ring
              cx="382"
              cy="384"
              r="306"
              stroke="oklch(0.82 0.02 252)"
              strokeWidth="1.2"
              pathLength={1920}
              strokeDasharray="1.2 8.8"
              strokeLinecap="round"
              opacity=".7"
            />
          </g>

          <g data-house-parallax>
            <g data-house>
              <ellipse
                cx="396"
                cy="568"
                rx="250"
                ry="16"
                fill="var(--navy)"
                opacity=".07"
                filter="url(#hero-soft)"
              />
              <line x1="150" y1="564.5" x2="640" y2="564.5" stroke="var(--border)" />
              {/* träd */}
              <line
                x1="214"
                y1="564"
                x2="214"
                y2="512"
                stroke="oklch(0.6 0.03 150)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M214 440c-22 0-34 26-34 48 0 18 14 32 34 32s34-14 34-32c0-22-12-48-34-48Z"
                fill="oklch(0.78 0.085 150)"
              />
              <line
                x1="606"
                y1="564"
                x2="606"
                y2="530"
                stroke="oklch(0.6 0.03 150)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M606 486c-15 0-23 17-23 31 0 12 10 21 23 21s23-9 23-21c0-14-8-31-23-31Z"
                fill="oklch(0.82 0.07 150)"
              />
              {/* flygel */}
              <rect
                x="466"
                y="318"
                width="108"
                height="246.5"
                rx="7"
                fill="var(--surface-muted)"
                stroke="var(--border)"
              />
              <rect x="460" y="310" width="120" height="10" rx="4" fill="oklch(0.93 0.01 252)" />
              <rect x="534" y="296" width="26" height="14" rx="3" fill="oklch(0.93 0.01 252)" />
              {/* huvudkropp */}
              <rect
                x="262"
                y="196"
                width="206"
                height="368.5"
                rx="9"
                fill="var(--surface)"
                stroke="var(--border)"
              />
              <rect x="254" y="186" width="222" height="13" rx="5" fill="oklch(0.93 0.01 252)" />
              {/* trapphus i glas */}
              <rect x="344" y="206" width="42" height="358" rx="4" fill="url(#hero-glass)" />
              <g stroke="#fff" strokeWidth="2" opacity=".85">
                {[260, 314, 368, 422, 476].map((y) => (
                  <line key={y} x1="344" y1={y} x2="386" y2={y} />
                ))}
              </g>
              <rect x="338" y="508" width="54" height="5" rx="2.5" fill="var(--navy)" />
              <rect x="352" y="518" width="26" height="46" rx="3" fill="var(--navy)" />
              <circle cx="373" cy="542" r="1.6" fill="var(--glow)" />
              {/* fönster och balkonger */}
              {WINDOWS.map((w) => (
                <g key={w.id}>
                  <rect
                    x={w.x}
                    y={w.y}
                    width={w.w}
                    height={w.h}
                    rx="3"
                    fill="oklch(0.94 0.022 252)"
                  />
                  <rect
                    data-lit={w.id}
                    x={w.x}
                    y={w.y}
                    width={w.w}
                    height={w.h}
                    rx="3"
                    fill="oklch(0.88 0.1 84)"
                    opacity={BASE_LIT[w.id] ?? 0}
                  />
                  <line
                    x1={w.x + w.w / 2}
                    y1={w.y + 1}
                    x2={w.x + w.w / 2}
                    y2={w.y + w.h - 1}
                    stroke="#fff"
                    strokeWidth="1.6"
                  />
                </g>
              ))}
              {[1, 2, 3, 4, 5].map((i) => (
                <rect
                  key={i}
                  x="396"
                  y={216 + i * 54 + 38}
                  width="60"
                  height="4"
                  rx="2"
                  fill="oklch(0.9 0.008 252)"
                />
              ))}
            </g>
          </g>

          <g>
            {TARGETS.map((id) => (
              <g key={id} data-link>
                <path
                  stroke="var(--primary)"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                  opacity=".42"
                />
                <circle
                  data-start
                  r="2.6"
                  fill="var(--surface)"
                  stroke="var(--primary)"
                  strokeWidth="1.1"
                  opacity="0"
                />
                <circle data-end r="3" fill="var(--primary)" opacity="0" />
                <circle data-pulse r="2.2" fill="var(--glow)" opacity="0" />
              </g>
            ))}
          </g>
        </svg>

        <HeroCard>
          <CardHead label="Felanmälan" icon={<WrenchIcon />} />
          <p className="mt-2.5 text-[15.5px] font-semibold tracking-tight">Element i sovrum</p>
          <Pill tone="warning">
            <span className="size-1.5 rounded-full bg-warning" />
            Pågående
          </Pill>
        </HeroCard>

        <HeroCard>
          <CardHead label="Bokning" icon={<CalendarIcon />} />
          <p className="mt-2.5 text-[15.5px] font-semibold tracking-tight">Tvättstuga</p>
          <p className="text-sm text-muted-foreground tnum">18:00–20:00</p>
          <Pill tone="success">
            <svg
              viewBox="0 0 24 24"
              className="size-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                data-check
                d="M20 6 9 17l-5-5"
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset="1"
              />
            </svg>
            Bokad
          </Pill>
        </HeroCard>

        <HeroCard>
          <CardHead label="Information" icon={<DocIcon />} />
          <div className="mt-2 divide-y divide-border">
            {["Stadgar", "Årsredovisning"].map((d) => (
              <p key={d} className="flex items-center gap-2 py-1.5 text-sm font-medium">
                <DocIcon className="size-3.5 text-muted-foreground" />
                {d}
              </p>
            ))}
          </div>
        </HeroCard>

        <HeroCard className="w-[232px] rounded-[16px_16px_16px_5px]">
          <div className="flex items-start gap-2.5">
            <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-navy text-white">
              <MegaphoneIcon className="size-[15px]" />
            </span>
            <div>
              <p className="text-[14.5px] leading-snug font-medium">
                Ny information från styrelsen
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <span data-dot className="size-[7px] rounded-full bg-glow" />
                Styrelsen · nyss
              </p>
            </div>
          </div>
        </HeroCard>
      </div>
    </div>
  );
}

function HeroCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      data-card
      className={cn(
        "absolute top-0 left-0 w-[214px] origin-top-left rounded-2xl border border-border bg-surface px-4 pt-3.5 pb-4 opacity-0 will-change-transform",
        "shadow-[0_1px_1px_oklch(0.2_0.03_250_/_0.03),0_2px_6px_oklch(0.2_0.03_250_/_0.04),0_18px_40px_-8px_oklch(0.25_0.05_256_/_0.14)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CardHead({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-lg bg-primary-soft text-primary">
        {icon}
      </span>
      <span className="text-[11.5px] font-semibold tracking-[0.07em] text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
}

function Pill({ tone, children }: { tone: "warning" | "success"; children: React.ReactNode }) {
  return (
    <span
      data-pill
      className={cn(
        "mt-2.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12.5px] font-medium",
        tone === "warning"
          ? "border-warning/30 bg-warning-soft text-warning-foreground"
          : "border-success/20 bg-success-soft text-success",
      )}
    >
      {children}
    </span>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function WrenchIcon() {
  return (
    <svg {...iconProps} className="size-[15px]">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg {...iconProps} className="size-[15px]">
      <rect x="3" y="4.5" width="18" height="17" rx="3" />
      <path d="M8 2.5v4M16 2.5v4M3 10h18" />
    </svg>
  );
}

function DocIcon({ className = "size-[15px]" }: { className?: string }) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M15 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7Z" />
      <path d="M14.5 2.5V7h5" />
    </svg>
  );
}

function MegaphoneIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps} strokeWidth={1.8} className={className}>
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}
