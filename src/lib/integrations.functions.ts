import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { requirePermission } from "@/lib/app.functions";
import {
  buildBgMax,
  buildSie4,
  encodePc8,
  parseBankFile,
  type BankPayment,
  type SieVoucher,
} from "@/lib/bankfiles";

type Db = SupabaseClient<Database>;

/** Bankfiler är några hundra kB; 5 MB räcker med god marginal. */
const fileContent = z.string().min(10).max(5_000_000);
const month = z.string().regex(/^\d{4}-\d{2}$/, "Ange månad som ÅÅÅÅ-MM");

// BAS-konton som används i exporten.
const ACCOUNTS = {
  bank: { number: "1930", name: "Företagskonto/bankgiro" },
  receivable: { number: "1510", name: "Kundfordringar" },
  fee: { number: "3010", name: "Årsavgifter bostäder" },
  rent: { number: "3020", name: "Hyresintäkter bostäder" },
};

export const getIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { me, orgId } = await requirePermission(supabase, context.userId, "economy.edit");
    const [org, periods, unpaid] = await Promise.all([
      supabase
        .from("organizations")
        .select("name, bankgiro, org_number")
        .eq("id", orgId)
        .maybeSingle(),
      supabase
        .from("payments")
        .select("period")
        .eq("organization_id", orgId)
        .order("period", { ascending: false }),
      supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .neq("status", "paid"),
    ]);
    return {
      organization: org.data,
      periods: [...new Set((periods.data ?? []).map((p) => p.period.slice(0, 7)))],
      unpaid: unpaid.count ?? 0,
      canEditOrganization: me.permissions.includes("settings.edit"),
    };
  });

export type BankMatch = BankPayment & {
  outcome: "pay" | "already" | "amount" | "unknown";
  payment: { id: string; unit: string | null; period: string; amount: number } | null;
};

/** Matchar bankens betalningar mot organisationens avier via OCR-numret. */
async function matchPayments(supabase: Db, orgId: string, content: string) {
  let parsed;
  try {
    parsed = parseBankFile(content);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Filen kunde inte läsas.");
  }
  const refs = [...new Set(parsed.payments.map((p) => p.reference).filter(Boolean))];
  const { data, error } = refs.length
    ? await supabase
        .from("payments")
        .select("id, ocr, amount, status, period, units(unit_number)")
        .eq("organization_id", orgId)
        .in("ocr", refs)
    : { data: [], error: null };
  if (error) throw new Error(error.message);
  const byOcr = new Map((data ?? []).map((p) => [p.ocr, p]));
  const matches: BankMatch[] = parsed.payments.map((bp) => {
    const p = byOcr.get(bp.reference);
    if (!p) return { ...bp, outcome: "unknown", payment: null };
    const payment = {
      id: p.id,
      unit: p.units?.unit_number ?? null,
      period: p.period,
      amount: Number(p.amount),
    };
    if (p.status === "paid") return { ...bp, outcome: "already", payment };
    if (bp.amount + 0.005 < payment.amount) return { ...bp, outcome: "amount", payment };
    return { ...bp, outcome: "pay", payment };
  });
  return { format: parsed.format, matches };
}

export const previewBankFile = createServerFn({ method: "POST" })
  .inputValidator(z.object({ content: fileContent }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "economy.edit");
    return matchPayments(supabase, orgId, data.content);
  });

/** Registrerar de betalningar som matchade en obetald avi med rätt belopp. */
export const applyBankFile = createServerFn({ method: "POST" })
  .inputValidator(z.object({ content: fileContent }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "economy.edit");
    const { format, matches } = await matchPayments(supabase, orgId, data.content);
    const toPay = matches.filter((m) => m.outcome === "pay" && m.payment);
    let registered = 0;
    for (const m of toPay) {
      const { data: rows, error } = await supabase
        .from("payments")
        .update({
          status: "paid",
          paid_at: m.date ? `${m.date}T12:00:00+02:00` : new Date().toISOString(),
          paid_via: format === "bgmax" ? "bankgiro" : "bank",
        })
        .eq("id", m.payment!.id)
        .eq("organization_id", orgId)
        .neq("status", "paid")
        .select("id");
      if (error) throw new Error(error.message);
      registered += rows?.length ?? 0;
    }
    return {
      registered,
      skipped: matches.length - registered,
      total: matches.length,
    };
  });

/** En BgMax-fil med några obetalda avier, för att prova importen. */
export const getSampleBankFile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "economy.edit");
    const [{ data: org }, { data: unpaid, error }] = await Promise.all([
      supabase.from("organizations").select("bankgiro").eq("id", orgId).maybeSingle(),
      supabase
        .from("payments")
        .select("ocr, amount, units(unit_number)")
        .eq("organization_id", orgId)
        .neq("status", "paid")
        .not("ocr", "is", null)
        .order("period", { ascending: false })
        .limit(6),
    ]);
    if (error) throw new Error(error.message);
    if (!unpaid?.length)
      throw new Error("Det finns inga obetalda avier att göra en exempelfil av.");
    const content = buildBgMax(
      org?.bankgiro ?? "0000-0000",
      unpaid.map((p) => ({ reference: p.ocr!, amount: Number(p.amount) })),
      new Date(),
    );
    return { fileName: `bgmax-exempel-${new Date().toISOString().slice(0, 10)}.txt`, content };
  });

/** Avier och inbetalningar som SIE 4-fil för bokföringsprogrammet. */
export const exportSie = createServerFn({ method: "POST" })
  .inputValidator(z.object({ from: month, to: month }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "economy.edit");
    if (data.to < data.from) throw new Error("Slutmånaden måste vara efter startmånaden.");
    const [{ data: org }, { data: payments, error }] = await Promise.all([
      supabase.from("organizations").select("name, org_number").eq("id", orgId).maybeSingle(),
      supabase
        .from("payments")
        .select("period, kind, amount, status, paid_at")
        .eq("organization_id", orgId)
        .gte("period", `${data.from}-01`)
        .lte("period", `${data.to}-01`)
        .order("period"),
    ]);
    if (error) throw new Error(error.message);
    if (!payments?.length) throw new Error("Det finns inga avier i den valda perioden.");

    const vouchers: SieVoucher[] = [];
    // En verifikation per aviserad månad.
    const byPeriod = new Map<string, { fee: number; rent: number }>();
    for (const p of payments) {
      const sums = byPeriod.get(p.period) ?? { fee: 0, rent: 0 };
      if (p.kind === "rent") sums.rent += Number(p.amount);
      else sums.fee += Number(p.amount);
      byPeriod.set(p.period, sums);
    }
    for (const [period, sums] of byPeriod) {
      const rows = [{ account: ACCOUNTS.receivable.number, amount: sums.fee + sums.rent }];
      if (sums.fee) rows.push({ account: ACCOUNTS.fee.number, amount: -sums.fee });
      if (sums.rent) rows.push({ account: ACCOUNTS.rent.number, amount: -sums.rent });
      vouchers.push({ date: period, text: `Avier ${period.slice(0, 7)}`, rows });
    }
    // En verifikation per betalningsdag.
    const byDay = new Map<string, number>();
    for (const p of payments) {
      if (p.status !== "paid" || !p.paid_at) continue;
      const day = p.paid_at.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + Number(p.amount));
    }
    for (const [day, sum] of [...byDay].sort(([a], [b]) => a.localeCompare(b))) {
      vouchers.push({
        date: day,
        text: `Inbetalningar ${day}`,
        rows: [
          { account: ACCOUNTS.bank.number, amount: sum },
          { account: ACCOUNTS.receivable.number, amount: -sum },
        ],
      });
    }
    vouchers.sort((a, b) => a.date.localeCompare(b.date));

    const year = data.from.slice(0, 4);
    const sie = buildSie4({
      company: org?.name ?? "Organisation",
      orgNumber: org?.org_number ?? null,
      fiscalYear: { start: `${year}-01-01`, end: `${year}-12-31` },
      accounts: Object.values(ACCOUNTS),
      vouchers,
      generated: new Date(),
    });
    return {
      fileName: `boendeplattformen-${data.from}-${data.to}.se`,
      base64: Buffer.from(encodePc8(sie)).toString("base64"),
      vouchers: vouchers.length,
    };
  });

export const saveBankDetails = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      bankgiro: z
        .string()
        .trim()
        .regex(/^(\d{3,4}-?\d{4})?$/, "Bankgironumret skrivs som 123-4567 eller 1234-5678"),
      orgNumber: z
        .string()
        .trim()
        .regex(/^(\d{6}-?\d{4})?$/, "Organisationsnumret skrivs som 769600-1234"),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "settings.edit");
    const { error } = await supabase
      .from("organizations")
      .update({ bankgiro: data.bankgiro || null, org_number: data.orgNumber || null })
      .eq("id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
