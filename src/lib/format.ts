export function kr(amount: number | string | null | undefined) {
  if (amount === null || amount === undefined) return "–";
  return `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(Number(amount))} kr`;
}

export function dateLong(value: string | Date | null | undefined) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function dateShort(value: string | Date | null | undefined) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short" }).format(
    new Date(value),
  );
}

export function dateTime(value: string | Date | null | undefined) {
  if (!value) return "–";
  const d = new Date(value);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit" }).format(d);
  if (sameDay) return `Idag ${time}`;
  return `${new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short" }).format(d)} ${time}`;
}

export function timeRange(start: string, end: string) {
  const fmt = new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit" });
  return `${fmt.format(new Date(start))}–${fmt.format(new Date(end))}`;
}

export function monthName(period: string | Date) {
  const label = new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" }).format(
    new Date(period),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function greeting(name?: string | null) {
  const h = new Date().getHours();
  const part = h < 10 ? "God morgon" : h < 12 ? "God förmiddag" : h < 18 ? "God dag" : "God kväll";
  const first = (name ?? "").split(" ")[0];
  return first ? `${part}, ${first}` : part;
}

export const requestStatusLabels: Record<string, string> = {
  new: "Nytt",
  received: "Mottaget",
  assigned: "Tilldelat",
  booked: "Bokat",
  in_progress: "Pågående",
  resolved: "Löst",
  closed: "Stängt",
};

export const priorityLabels: Record<string, string> = {
  low: "Låg",
  normal: "Normal",
  high: "Hög",
  urgent: "Akut",
};

export const projectStatusLabels: Record<string, string> = {
  done: "Klart",
  in_progress: "Pågår",
  planned: "Planerad",
};

export const categoryLabels = [
  { value: "Vatten", icon: "💧" },
  { value: "Värme", icon: "🌡️" },
  { value: "El", icon: "💡" },
  { value: "Dörr/lås", icon: "🔑" },
  { value: "Vitvaror", icon: "🧊" },
  { value: "Tvättstuga", icon: "🧺" },
  { value: "Ventilation", icon: "🌀" },
  { value: "Annat", icon: "🧩" },
];

export const resourceKindLabels: Record<string, string> = {
  laundry: "Tvättstuga",
  sauna: "Bastu",
  guest_room: "Gästrum",
  party_room: "Festlokal",
  hobby: "Hobbyrum",
  parking: "Parkering",
  ev_charger: "Laddplats",
};

export function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const docTypeLabels: Record<string, string> = {
  bylaws: "Stadgar",
  statutes: "Stadgar",
  protocol: "Protokoll",
  minutes: "Protokoll",
  annual_report: "Årsredovisning",
  economy: "Ekonomi",
  contract: "Avtal",
  maintenance: "Underhåll",
  insurance: "Försäkring",
  rules: "Ordningsregler",
  info: "Information",
  other: "Övrigt",
};

export function docTypeLabel(type: string) {
  return docTypeLabels[type] ?? type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
}

export function authorRoleLabel(role: string) {
  if (role === "resident") return "Boende";
  if (role === "contractor") return "Entreprenör";
  if (role === "board_member") return "Styrelsen";
  return "Förvaltning";
}

export const inspectionKindLabels = {
  periodic: "Lägenhetsbesiktning",
  move_in: "Inflyttningsbesiktning",
  move_out: "Avflyttningsbesiktning",
  ovk: "OVK (ventilation)",
  elevator: "Hissbesiktning",
  fire: "Brandskyddskontroll",
  other: "Övrig besiktning",
} as const;

export const inspectionResultLabels = {
  approved: "Godkänd",
  remarks: "Godkänd med anmärkningar",
  failed: "Underkänd",
} as const;
