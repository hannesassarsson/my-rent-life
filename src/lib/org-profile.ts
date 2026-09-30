/**
 * En kodbas, flera organisationstyper. Profilen styr orden i menyer och
 * rubriker: en hyresvärd har hyresgäster som betalar hyra, en
 * bostadsrättsförening har medlemmar som betalar avgift. Enskilda lägenheter
 * kan ändå vara hyresrätter i en BRF; där styr lägenhetens upplåtelseform.
 */
export type OrgKind = "rental" | "brf";

export type OrgProfile = {
  kind: OrgKind;
  /** Organisationstypen i klartext */
  orgTypeLabel: string;
  residentWord: string;
  residentPlural: string;
  /** Månadsbetalningen */
  feeWord: string;
  feeWordLong: string;
  /** Den boendes egen sida */
  homeLabel: string;
  meetingsLabel: string;
};

export const orgProfiles: Record<OrgKind, OrgProfile> = {
  rental: {
    kind: "rental",
    orgTypeLabel: "Hyresvärd",
    residentWord: "Hyresgäst",
    residentPlural: "Hyresgäster",
    feeWord: "Hyra",
    feeWordLong: "Min hyra",
    homeLabel: "Min lägenhet",
    meetingsLabel: "Möten",
  },
  brf: {
    kind: "brf",
    orgTypeLabel: "Bostadsrättsförening",
    residentWord: "Medlem",
    residentPlural: "Medlemmar",
    feeWord: "Avgift",
    feeWordLong: "Min avgift",
    homeLabel: "Mitt boende",
    meetingsLabel: "Stämmor och möten",
  },
};

/** Nycklar i profilen som kan användas som menyrubrik. */
export type OrgTerm = "residentPlural" | "feeWordLong" | "homeLabel" | "meetingsLabel";

export function orgProfileFor(orgType?: string | null): OrgProfile {
  // "manager" (förvaltare) och "rental" visas som hyresvärd.
  if (orgType === "rental" || orgType === "manager") return orgProfiles.rental;
  return orgProfiles.brf;
}
