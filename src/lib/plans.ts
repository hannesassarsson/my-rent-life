// Planer, priser och vad som ingår. Delas av servern (spärrar, Stripe) och
// gränssnittet (prissidan, abonnemangssidan, menyn).

import type { Permission } from "@/lib/permissions";

export const PLAN_IDS = ["bas", "standard", "forvaltning"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/** Funktioner som skiljer planerna åt. Allt annat ingår i alla planer. */
export type Feature = "economy" | "meetings" | "inspections" | "maintenance" | "contractors";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  /** Kronor per lägenhet och månad, exklusive moms */
  perUnit: number;
  /** Lägsta pris per månad, exklusive moms */
  minMonthly: number;
  features: readonly Feature[];
  highlights: readonly string[];
};

const ALL_FEATURES: readonly Feature[] = [
  "economy",
  "meetings",
  "inspections",
  "maintenance",
  "contractors",
];

export const PLANS: Record<PlanId, Plan> = {
  bas: {
    id: "bas",
    name: "Bas",
    tagline: "För mindre föreningar som vill komma igång",
    perUnit: 9,
    minMonthly: 199,
    features: [],
    highlights: [
      "Boendeapp för alla boende",
      "Felanmälan med bilder och status",
      "Bokning av tvättstuga och lokaler",
      "Information, dokument och meddelanden",
    ],
  },
  standard: {
    id: "standard",
    name: "Standard",
    tagline: "Hela plattformen för föreningen eller hyresvärden",
    perUnit: 15,
    minMonthly: 399,
    features: ALL_FEATURES,
    highlights: [
      "Allt i Bas",
      "Ekonomi: avisering, påminnelser och export",
      "Möten och stämmor med protokoll",
      "Besiktningar och underhållsplan",
      "Entreprenörsportal och alla roller",
    ],
  },
  forvaltning: {
    id: "forvaltning",
    name: "Förvaltning",
    tagline: "För förvaltare och hyresvärdar med flera fastigheter",
    perUnit: 22,
    minMonthly: 1490,
    features: ALL_FEATURES,
    highlights: [
      "Allt i Standard",
      "Flera organisationer i samma konto",
      "Prioriterad support",
      "Hjälp med import av befintlig data",
    ],
  },
};

/** Årsbetalning: tolv månader till priset av tio. */
export const YEARLY_MONTHS_CHARGED = 10;
export const VAT_RATE = 0.25;
/** Dagar med provperiod för nya organisationer. */
export const TRIAL_DAYS = 30;
/** Dagar efter en misslyckad betalning innan kontot blir skrivskyddat. */
export const GRACE_DAYS = 14;

/**
 * Antalet lägenheter som debiteras: minst så många att lägsta priset nås.
 * Stripe räknar pris × antal, så lägsta priset uttrycks som ett lägsta antal.
 */
export function billableUnits(plan: PlanId, units: number) {
  const p = PLANS[plan];
  return Math.max(units, Math.ceil(p.minMonthly / p.perUnit));
}

/** Pris i kronor exklusive moms för en månad eller ett år. */
export function priceFor(plan: PlanId, units: number, interval: BillingInterval) {
  const monthly = billableUnits(plan, units) * PLANS[plan].perUnit;
  return interval === "year" ? monthly * YEARLY_MONTHS_CHARGED : monthly;
}

/** Vilken planfunktion en behörighet hör till. */
const PERMISSION_FEATURE: Partial<Record<Permission, Feature>> = {
  "economy.view": "economy",
  "economy.edit": "economy",
  "meetings.edit": "meetings",
  "inspections.view": "inspections",
  "inspections.edit": "inspections",
  "maintenance.view": "maintenance",
  "maintenance.edit": "maintenance",
  "contractors.view": "contractors",
  "contractors.edit": "contractors",
};

export function featureFor(permission: Permission): Feature | undefined {
  return PERMISSION_FEATURE[permission];
}

export type SubscriptionRow = {
  plan: string;
  status: string;
  trial_ends_at: string | null;
  past_due_since: string | null;
  is_demo: boolean;
  invoice_billing: boolean;
};

/**
 * ok ....... allt fungerar
 * trial .... provperiod pågår
 * grace .... betalningen misslyckades, fristen löper
 * locked ... provperioden är slut eller abonnemanget avslutat: skrivskyddat
 */
export type AccessState = "ok" | "trial" | "grace" | "locked";

export function accessFor(
  sub: SubscriptionRow | null,
  now = Date.now(),
): {
  plan: PlanId;
  state: AccessState;
  features: Feature[];
} {
  const plan = (PLAN_IDS as readonly string[]).includes(sub?.plan ?? "")
    ? (sub!.plan as PlanId)
    : "standard";
  const features = [...PLANS[plan].features];
  // Organisationer utan abonnemangsrad (skapade före betalningen) och
  // demoföreningen spärras aldrig.
  if (!sub || sub.is_demo) return { plan, state: "ok", features };
  if (sub.invoice_billing) return { plan, state: "ok", features };

  let state: AccessState;
  switch (sub.status) {
    case "active":
      state = "ok";
      break;
    case "trialing":
      state = sub.trial_ends_at && new Date(sub.trial_ends_at).getTime() > now ? "trial" : "locked";
      break;
    case "past_due":
      state =
        sub.past_due_since && new Date(sub.past_due_since).getTime() + GRACE_DAYS * 864e5 > now
          ? "grace"
          : "locked";
      break;
    default:
      state = "locked";
  }
  return { plan, state, features };
}

/**
 * Behörigheter efter plan och betalstatus: funktioner som inte ingår i planen
 * tas bort, och ett spärrat konto får bara läsa (och sköta abonnemanget).
 */
export function applyPlan(
  permissions: readonly Permission[],
  access: { state: AccessState; features: readonly Feature[] },
): { permissions: Permission[]; planLocked: Permission[] } {
  const allowed: Permission[] = [];
  const planLocked: Permission[] = [];
  for (const p of permissions) {
    const feature = featureFor(p);
    if (feature && !access.features.includes(feature)) {
      planLocked.push(p);
      continue;
    }
    if (access.state === "locked" && p.endsWith(".edit") && p !== "settings.edit") continue;
    allowed.push(p);
  }
  return { permissions: allowed, planLocked };
}

export const kronor = (n: number) =>
  new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n) + " kr";
