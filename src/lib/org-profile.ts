import {
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileSignature,
  FileText,
  Gavel,
  HardHat,
  Hammer,
  Home,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Settings,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

import type { NavItem } from "@/components/app-shell";

/**
 * En kodbas, flera organisationstyper.
 * Lägg till en ny typ genom att lägga till en post i `orgProfiles`.
 */
export type OrgKind = "rental" | "brf";

export type OrgProfile = {
  kind: OrgKind;
  /** Namn på systemläget, visas i administrationen */
  systemLabel: string;
  orgTypeLabel: string;
  /** Boende-terminologi */
  residentWord: string;
  residentPlural: string;
  /** Månadsbetalning */
  feeWord: string;
  feeWordLong: string;
  /** Rubrik för boendes egen sida */
  homeLabel: string;
  adminNav: NavItem[];
  residentNav: NavItem[];
};

const commonAdminTail: NavItem[] = [
  { label: "Bokningar", to: "/admin/bokningar", icon: CalendarCheck },
  { label: "Kommunikation", to: "/admin/kommunikation", icon: Megaphone },
  { label: "Entreprenörer", to: "/admin/entreprenorer", icon: HardHat },
  { label: "Underhållsplan", to: "/admin/underhall", icon: Hammer },
  { label: "Inställningar", to: "/admin/installningar", icon: Settings },
];

export const orgProfiles: Record<OrgKind, OrgProfile> = {
  rental: {
    kind: "rental",
    systemLabel: "Hyresvärd",
    orgTypeLabel: "Hyresfastigheter",
    residentWord: "Hyresgäst",
    residentPlural: "Hyresgäster",
    feeWord: "Hyra",
    feeWordLong: "Min hyra",
    homeLabel: "Min lägenhet",
    adminNav: [
      { label: "Översikt", to: "/admin", icon: LayoutDashboard },
      { label: "Ärenden", to: "/admin/arenden", icon: Wrench },
      { label: "Fastigheter", to: "/admin/fastigheter", icon: Building2 },
      { label: "Hyresgäster", to: "/admin/boende", icon: Users },
      { label: "Hyresavtal", to: "/admin/avtal", icon: FileSignature },
      { label: "Uthyrning", to: "/admin/uthyrning", icon: KeyRound },
      { label: "Besiktningar", to: "/admin/besiktningar", icon: ClipboardCheck },
      { label: "Hyror & ekonomi", to: "/admin/ekonomi", icon: Wallet },
      ...commonAdminTail,
    ],
    residentNav: [
      { label: "Översikt", to: "/app", icon: LayoutDashboard },
      { label: "Min lägenhet", to: "/app/boende", icon: Home },
      { label: "Felanmälan", to: "/app/felanmalan", icon: Wrench },
      { label: "Bokningar", to: "/app/bokningar", icon: CalendarDays },
      { label: "Information", to: "/app/information", icon: Megaphone },
      { label: "Dokument", to: "/app/dokument", icon: FileText },
      { label: "Min hyra", to: "/app/ekonomi", icon: CreditCard },
      { label: "Meddelanden", to: "/app/meddelanden", icon: MessageSquare },
    ],
  },
  brf: {
    kind: "brf",
    systemLabel: "Bostadsrättsförening",
    orgTypeLabel: "Bostadsrättsförening",
    residentWord: "Medlem",
    residentPlural: "Medlemmar",
    feeWord: "Avgift",
    feeWordLong: "Min avgift",
    homeLabel: "Mitt boende",
    adminNav: [
      { label: "Översikt", to: "/admin", icon: LayoutDashboard },
      { label: "Ärenden", to: "/admin/arenden", icon: Wrench },
      { label: "Fastigheter", to: "/admin/fastigheter", icon: Building2 },
      { label: "Medlemmar", to: "/admin/boende", icon: Users },
      { label: "Styrelse", to: "/admin/styrelse", icon: Gavel },
      { label: "Avgifter", to: "/admin/ekonomi", icon: Wallet },
      ...commonAdminTail,
    ],
    residentNav: [
      { label: "Översikt", to: "/app", icon: LayoutDashboard },
      { label: "Mitt boende", to: "/app/boende", icon: Home },
      { label: "Felanmälan", to: "/app/felanmalan", icon: Wrench },
      { label: "Bokningar", to: "/app/bokningar", icon: CalendarDays },
      { label: "Information", to: "/app/information", icon: Megaphone },
      { label: "Dokument", to: "/app/dokument", icon: FileText },
      { label: "Möten & stämmor", to: "/app/moten", icon: Users },
      { label: "Min avgift", to: "/app/ekonomi", icon: CreditCard },
      { label: "Meddelanden", to: "/app/meddelanden", icon: MessageSquare },
    ],
  },
};

export const orgKinds = Object.keys(orgProfiles) as OrgKind[];

export function orgProfileFor(orgType?: string | null): OrgProfile {
  if (orgType && orgType in orgProfiles) return orgProfiles[orgType as OrgKind];
  // "manager" och okända typer visas som hyresvärdsläge
  if (orgType === "manager" || orgType === "rental") return orgProfiles.rental;
  return orgProfiles.brf;
}
