import { Check, KeyRound } from "lucide-react";

import { StatusPill } from "@/components/status-badge";
import {
  ADDONS,
  ADDON_IDS,
  PLANS,
  PLAN_IDS,
  VAT_RATE,
  YEARLY_MONTHS_CHARGED,
  billableUnits,
  extraAddons,
  kronor,
  priceFor,
  type AddonId,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

export type PlanChoice = { plan: PlanId; addons: AddonId[]; interval: BillingInterval };

/**
 * Val av plan och tillägg med löpande pris. Används på prissidan och på
 * abonnemangssidan; knappen för att gå vidare läggs in av den som använder
 * komponenten.
 */
export function PlanPicker({
  units,
  value,
  onChange,
  currentPlan,
  action,
}: {
  units: number;
  value: PlanChoice;
  onChange: (v: PlanChoice) => void;
  /** Markerar organisationens nuvarande plan. */
  currentPlan?: PlanId | null;
  action?: React.ReactNode;
}) {
  const per = value.interval === "year" ? "år" : "mån";
  const factor = value.interval === "year" ? YEARLY_MONTHS_CHARGED : 1;
  const extras = extraAddons(value.plan, value.addons);
  const total = priceFor(value.plan, units, value.interval, value.addons);
  const base = billableUnits(value.plan, units) * PLANS[value.plan].perUnit * factor;
  const separateCost = ADDON_IDS.filter((a) => a !== "keys").reduce(
    (sum, a) => sum + ADDONS[a].perUnit,
    PLANS.bas.perUnit,
  );

  const toggle = (addon: AddonId) =>
    onChange({
      ...value,
      addons: value.addons.includes(addon)
        ? value.addons.filter((a) => a !== addon)
        : [...value.addons, addon],
    });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">1. Välj grund</h2>
        <IntervalToggle
          value={value.interval}
          onChange={(interval) => onChange({ ...value, interval })}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLAN_IDS.map((id) => {
          const plan = PLANS[id];
          const selected = value.plan === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ ...value, plan: id })}
              aria-pressed={selected}
              className={cn(
                "card-surface flex flex-col p-5 text-left transition-shadow",
                selected ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-border",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-base font-semibold">{plan.name}</span>
                {currentPlan === id ? (
                  <StatusPill tone="success">Nuvarande</StatusPill>
                ) : id === "standard" ? (
                  <StatusPill tone="info">Vanligast</StatusPill>
                ) : null}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">{plan.tagline}</span>
              <span className="mt-4">
                <span className="text-2xl font-semibold tnum">{plan.perUnit} kr</span>
                <span className="text-sm text-muted-foreground"> / lägenhet och månad</span>
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                Lägsta pris {kronor(plan.minMonthly)}/mån
                {id === "standard"
                  ? ` · ${separateCost - plan.perUnit} kr billigare än Bas med samma tillägg`
                  : ""}
              </span>
              <span className="mt-4 flex-1 space-y-2 text-sm">
                {plan.highlights.map((h) => (
                  <span key={h} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    {h}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div>
        <h2 className="text-lg font-semibold tracking-tight">2. Lägg till det ni behöver</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tilläggen kostar per lägenhet och månad. Det som ingår i planen ni valt är redan markerat.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {ADDON_IDS.map((id) => {
            const addon = ADDONS[id];
            const included = PLANS[value.plan].included.includes(id);
            const checked = included || value.addons.includes(id);
            return (
              <label
                key={id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                  checked ? "border-primary/40 bg-primary/5" : "border-border",
                  included && "cursor-default",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-[var(--primary)]"
                  checked={checked}
                  disabled={included}
                  onChange={() => toggle(id)}
                />
                <span className="flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {id === "keys" ? <KeyRound className="size-4" /> : null}
                    {addon.name}
                    {id === "keys" ? <StatusPill tone="info">Nyhet</StatusPill> : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {addon.description}
                  </span>
                </span>
                <span className="text-sm whitespace-nowrap tnum">
                  {included ? <span className="text-success">Ingår</span> : `+${addon.perUnit} kr`}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="card-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">3. Ert pris</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt>
              {PLANS[value.plan].name}
              <span className="text-muted-foreground">
                {billableUnits(value.plan, units) > units
                  ? ` · lägsta pris`
                  : ` · ${PLANS[value.plan].perUnit} kr × ${units} lägenheter`}
              </span>
            </dt>
            <dd className="tnum">{kronor(base)}</dd>
          </div>
          {extras.map((a) => (
            <div key={a} className="flex justify-between gap-3">
              <dt>
                {ADDONS[a].name}
                <span className="text-muted-foreground">
                  {" "}
                  · {ADDONS[a].perUnit} kr × {units} lägenheter
                </span>
              </dt>
              <dd className="tnum">{kronor(ADDONS[a].perUnit * units * factor)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t border-border pt-3 text-base font-semibold">
            <dt>Totalt per {per === "år" ? "år" : "månad"}</dt>
            <dd className="tnum">{kronor(total)}</dd>
          </div>
          <div className="flex justify-between gap-3 text-xs text-muted-foreground">
            <dt>Inklusive 25 % moms</dt>
            <dd className="tnum">{kronor(total * (1 + VAT_RATE))}</dd>
          </div>
          {value.interval === "year" ? (
            <p className="text-xs text-muted-foreground">
              Motsvarar {kronor(total / 12)} per månad – två månader gratis.
            </p>
          ) : null}
          {extras.includes("keys") ? (
            <p className="text-xs text-muted-foreground">
              Digitala nycklar kräver NFC-läsare vid dörrarna. Läsare och installation offereras
              separat.
            </p>
          ) : null}
        </dl>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}

function IntervalToggle({
  value,
  onChange,
}: {
  value: BillingInterval;
  onChange: (v: BillingInterval) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm">
      {(
        [
          ["month", "Månadsvis"],
          ["year", "Årsvis – 2 månader gratis"],
        ] as const
      ).map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "rounded-md px-3 py-1.5 transition-colors",
            value === v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
