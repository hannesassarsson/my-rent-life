// Behörigheter per roll. Används både av servern (requirePermission) och av
// gränssnittet (meny och knappar). Databasens radregler är grövre: alla
// personalroller räknas som personal där; finare uppdelning görs här.

export const PERMISSIONS = [
  "overview",
  "requests.view",
  "requests.edit",
  "residents.view",
  "residents.edit",
  "properties.view",
  "properties.edit",
  "economy.view",
  "economy.edit",
  "bookings.edit",
  "communication.edit",
  "documents.edit",
  "meetings.edit",
  "messages.edit",
  "contractors.view",
  "contractors.edit",
  "maintenance.view",
  "maintenance.edit",
  "settings.edit",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  super_admin: ALL,
  org_admin: ALL,
  // Förvaltare: allt utom organisationsinställningar och roller.
  property_manager: ALL.filter((p) => p !== "settings.edit"),
  // Styrelse: följer ekonomi och ärenden, sköter kommunikation, möten och
  // underhållsplan.
  board_member: [
    "overview",
    "requests.view",
    "residents.view",
    "properties.view",
    "economy.view",
    "communication.edit",
    "documents.edit",
    "meetings.edit",
    "messages.edit",
    "contractors.view",
    "maintenance.view",
    "maintenance.edit",
  ],
  // Fastighetsskötare: ärenden, fastigheter, bokningar och entreprenörer.
  staff: [
    "overview",
    "requests.view",
    "requests.edit",
    "residents.view",
    "properties.view",
    "bookings.edit",
    "contractors.view",
    "maintenance.view",
  ],
};

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Superadmin",
  org_admin: "Administratör",
  property_manager: "Förvaltare",
  board_member: "Styrelseledamot",
  staff: "Fastighetsskötare",
  contractor: "Entreprenör",
  resident: "Boende",
};

/** Roller som kan tilldelas i inställningarna, i den ordning de visas. */
export const ASSIGNABLE_ROLES = [
  "org_admin",
  "property_manager",
  "board_member",
  "staff",
  "contractor",
  "resident",
] as const;

export function permissionsFor(roles: readonly string[]): Permission[] {
  const set = new Set<Permission>();
  for (const role of roles) for (const p of ROLE_PERMISSIONS[role] ?? []) set.add(p);
  return [...set];
}

export function hasPermission(roles: readonly string[], permission: Permission) {
  return roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission));
}

export type HomeArea = "/app" | "/admin" | "/entreprenor";

/** Var en användare ska landa efter inloggning. */
export function homeFor(me: { roles: string[]; hasResidency: boolean }): HomeArea {
  if (me.hasResidency) return "/app";
  if (permissionsFor(me.roles).length > 0) return "/admin";
  if (me.roles.includes("contractor")) return "/entreprenor";
  return "/app";
}
