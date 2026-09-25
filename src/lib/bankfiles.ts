// Filformat för bank och bokföring. Rena funktioner utan databas, så att de
// kan testas fristående.
//
//   BgMax ...... Bankgirots inbetalningsfil. Levereras av alla svenska banker
//                till den som har Bankgiro Inbetalningar med OCR.
//   camt.054 ... ISO 20022-avisering av insättningar (SEB, Swedbank,
//                Handelsbanken, Nordea, Danske Bank m.fl.).
//   SIE 4 ...... Svensk standard för bokföringsdata. Läses in av Fortnox,
//                Visma eEkonomi, Visma Administration, Björn Lundén m.fl.

export type BankPayment = {
  /** OCR-nummer eller annan referens, bara siffror */
  reference: string;
  /** Belopp i kronor */
  amount: number;
  /** Bokföringsdag, ÅÅÅÅ-MM-DD */
  date: string | null;
  payer: string | null;
};

export type ParsedBankFile = {
  format: "bgmax" | "camt054";
  payments: BankPayment[];
  receiver: string | null;
};

const isoDate = (yyyymmdd: string) =>
  /^\d{8}$/.test(yyyymmdd)
    ? `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
    : null;

/** Kontrollsiffra enligt Luhn (modulus 10), som Bankgirot använder för OCR. */
export function luhnCheckDigit(base: string) {
  let sum = 0;
  for (let i = base.length - 1, pos = 0; i >= 0; i--, pos++) {
    let d = Number(base[i]);
    if (pos % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidOcr(ocr: string) {
  return /^\d{2,25}$/.test(ocr) && luhnCheckDigit(ocr.slice(0, -1)) === Number(ocr.slice(-1));
}

/**
 * BgMax: fasta poster om 80 tecken. TK20 är en betalning (referens i
 * position 13–37, belopp i öre i 38–55); TK15 avslutar en insättning och
 * anger betalningsdagen (38–45) för betalningarna före den.
 */
export function parseBgMax(content: string): ParsedBankFile {
  const lines = content.split(/\r?\n/).filter((l) => l.length >= 2);
  if (!lines[0]?.startsWith("01BGMAX")) throw new Error("Filen är inte en BgMax-fil.");
  const payments: BankPayment[] = [];
  let pending: BankPayment[] = [];
  let receiver: string | null = null;
  for (const line of lines) {
    const tk = line.slice(0, 2);
    if (tk === "05") {
      receiver = line.slice(2, 12).replace(/^0+/, "") || null;
    } else if (tk === "20") {
      pending.push({
        payer: line.slice(2, 12).replace(/^0+/, "") || null,
        reference: line.slice(12, 37).trim().replace(/\D/g, ""),
        amount: Number(line.slice(37, 55)) / 100,
        date: null,
      });
    } else if (tk === "15") {
      const date = isoDate(line.slice(37, 45));
      for (const p of pending) payments.push({ ...p, date });
      pending = [];
    }
  }
  payments.push(...pending);
  return { format: "bgmax", payments, receiver };
}

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`));
  return m ? m[1]!.trim() : null;
};
const blocks = (xml: string, name: string) =>
  xml.match(new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>[\\s\\S]*?</(?:\\w+:)?${name}>`, "g")) ?? [];

/**
 * camt.054: insättningar (CRDT) med strukturerad referens (OCR) i
 * RmtInf/Strd/CdtrRefInf/Ref, eller fritext i RmtInf/Ustrd.
 */
export function parseCamt054(content: string): ParsedBankFile {
  if (!/camt\.054/.test(content) || !/<(?:\w+:)?Ntry\b/.test(content)) {
    throw new Error("Filen är inte en camt.054-fil.");
  }
  const payments: BankPayment[] = [];
  const receiver = tag(tag(content, "Acct") ?? "", "IBAN");
  for (const entry of blocks(content, "Ntry")) {
    if (tag(entry, "CdtDbtInd") !== "CRDT") continue;
    const date = tag(tag(entry, "BookgDt") ?? "", "Dt") ?? tag(tag(entry, "ValDt") ?? "", "Dt");
    const details = blocks(entry, "TxDtls");
    for (const tx of details.length > 0 ? details : [entry]) {
      const ref = tag(tx, "Ref") ?? tag(tx, "Ustrd") ?? "";
      const amount = Number(tag(tx, "Amt") ?? tag(entry, "Amt") ?? "0");
      payments.push({
        reference: ref.replace(/\D/g, ""),
        amount,
        date: date ? date.slice(0, 10) : null,
        payer: tag(tag(tx, "Dbtr") ?? "", "Nm"),
      });
    }
  }
  return { format: "camt054", payments, receiver };
}

export function parseBankFile(content: string): ParsedBankFile {
  const text = content.replace(/^﻿/, "");
  if (text.startsWith("01BGMAX")) return parseBgMax(text);
  if (/camt\.054/.test(text)) return parseCamt054(text);
  throw new Error("Okänt filformat. Använd BgMax (.txt) eller camt.054 (.xml) från banken.");
}

/** En BgMax-fil med givna betalningar, t.ex. som exempelfil i demon. */
export function buildBgMax(
  receiverBankgiro: string,
  payments: { reference: string; amount: number; payer?: string }[],
  date: Date,
) {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const pad = (s: string, n: number, c = " ", left = false) =>
    left ? s.slice(0, n).padStart(n, c) : s.slice(0, n).padEnd(n, c);
  const bg = receiverBankgiro.replace(/\D/g, "");
  const lines = [
    pad(`01BGMAX               01${ymd}120000000000P`, 80),
    pad(`05${pad(bg, 10, "0", true)}${" ".repeat(10)}SEK`, 80),
  ];
  let total = 0;
  payments.forEach((p, i) => {
    const ore = Math.round(p.amount * 100);
    total += ore;
    lines.push(
      pad(
        `20${pad((p.payer ?? "").replace(/\D/g, ""), 10, "0", true)}${pad(p.reference, 25)}${pad(String(ore), 18, "0", true)}21${pad(String(i + 1), 12, "0", true)}0`,
        80,
      ),
    );
  });
  lines.push(
    pad(
      `15${pad("", 35)}${ymd}00001${pad(String(total), 18, "0", true)}SEK${pad(String(payments.length), 8, "0", true)}`,
      80,
    ),
  );
  lines.push(
    pad(`70${pad(String(payments.length), 8, "0", true)}00000000000000000000000000000001`, 80),
  );
  return lines.join("\r\n") + "\r\n";
}

/* ------------------------------ SIE 4 ------------------------------ */

export type SieAccount = { number: string; name: string };
export type SieVoucher = {
  date: string; // ÅÅÅÅ-MM-DD
  text: string;
  rows: { account: string; amount: number }[];
};

const sieText = (s: string) => `"${s.replace(/"/g, "'")}"`;
const sieDate = (d: string) => d.replace(/-/g, "");
const sieAmount = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/**
 * En SIE 4-fil (verifikationer). Beloppen i varje verifikation måste
 * balansera; debet är positivt och kredit negativt.
 */
export function buildSie4(opts: {
  company: string;
  orgNumber: string | null;
  fiscalYear: { start: string; end: string };
  accounts: SieAccount[];
  vouchers: SieVoucher[];
  generated: Date;
}) {
  const lines = [
    "#FLAGGA 0",
    `#PROGRAM ${sieText("Boendeplattformen")} 1.0`,
    "#FORMAT PC8",
    `#GEN ${sieDate(opts.generated.toISOString().slice(0, 10))}`,
    "#SIETYP 4",
    `#FNAMN ${sieText(opts.company)}`,
  ];
  if (opts.orgNumber) lines.push(`#ORGNR ${opts.orgNumber}`);
  lines.push(`#RAR 0 ${sieDate(opts.fiscalYear.start)} ${sieDate(opts.fiscalYear.end)}`);
  for (const a of opts.accounts) lines.push(`#KONTO ${a.number} ${sieText(a.name)}`);
  opts.vouchers.forEach((v, i) => {
    const sum = v.rows.reduce((s, r) => s + Math.round(r.amount * 100), 0);
    if (sum !== 0) throw new Error(`Verifikationen "${v.text}" balanserar inte.`);
    lines.push(`#VER A ${i + 1} ${sieDate(v.date)} ${sieText(v.text)}`, "{");
    for (const r of v.rows) lines.push(`   #TRANS ${r.account} {} ${sieAmount(r.amount)}`);
    lines.push("}");
  });
  return lines.join("\r\n") + "\r\n";
}

/** SIE-filer ska vara kodade som PC8 (IBM-teckentabell 437). */
const CP437: Record<string, number> = {
  Ç: 0x80,
  ü: 0x81,
  é: 0x82,
  â: 0x83,
  ä: 0x84,
  à: 0x85,
  å: 0x86,
  ç: 0x87,
  ê: 0x88,
  ë: 0x89,
  è: 0x8a,
  ï: 0x8b,
  î: 0x8c,
  ì: 0x8d,
  Ä: 0x8e,
  Å: 0x8f,
  É: 0x90,
  æ: 0x91,
  Æ: 0x92,
  ô: 0x93,
  ö: 0x94,
  ò: 0x95,
  û: 0x96,
  ù: 0x97,
  ÿ: 0x98,
  Ö: 0x99,
  Ü: 0x9a,
  á: 0xa0,
  í: 0xa1,
  ó: 0xa2,
  ú: 0xa3,
  ñ: 0xa4,
  Ñ: 0xa5,
};

export function encodePc8(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const code = ch.charCodeAt(0);
    bytes[i] = code < 0x80 ? code : (CP437[ch] ?? 0x3f);
  }
  return bytes;
}
