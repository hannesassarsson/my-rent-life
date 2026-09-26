// Svenska personnummer (och samordningsnummer). Rena funktioner utan
// beroenden, så att de kan användas både i webbläsaren och på servern.

import { luhnCheckDigit } from "@/lib/bankfiles";

/**
 * Personnumret som 12 siffror (ÅÅÅÅMMDDNNNN), eller null om det inte är
 * giltigt. Tar emot ÅÅMMDD-NNNN, ÅÅMMDD+NNNN (100 år eller äldre),
 * ÅÅÅÅMMDD-NNNN och varianter utan bindestreck.
 */
export function normalizePersonnummer(raw: string, today = new Date()): string | null {
  const s = raw.trim().replace(/\s/g, "");
  const m = /^(\d{2})?(\d{6})([-+]?)(\d{4})$/.exec(s);
  if (!m) return null;
  const [, century, yymmdd, sep, last4] = m as unknown as [
    string,
    string | undefined,
    string,
    string,
    string,
  ];
  let full: string;
  if (century) {
    full = `${century}${yymmdd}${last4}`;
  } else {
    const yy = Number(yymmdd.slice(0, 2));
    const thisYear = today.getFullYear();
    let year = Math.floor(thisYear / 100) * 100 + yy;
    if (year > thisYear) year -= 100;
    if (sep === "+") year -= 100;
    full = `${year}${yymmdd.slice(2)}${last4}`;
  }
  const month = Number(full.slice(4, 6));
  // Samordningsnummer har 60 adderat till dagen.
  const rawDay = Number(full.slice(6, 8));
  const day = rawDay > 60 ? rawDay - 60 : rawDay;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const ten = full.slice(2);
  if (luhnCheckDigit(ten.slice(0, 9)) !== Number(ten[9])) return null;
  return full;
}

/** Visas för användaren: bara de fyra sista siffrorna. */
export function personnummerHint(pnr: string) {
  return `••••••••-${pnr.slice(-4)}`;
}
