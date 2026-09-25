import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { requirePermission } from "@/lib/app.functions";
import { bankIdConfigured, personnummerForStorage, sealState } from "@/lib/bankid.server";
import { serverDb, serverSecret } from "@/lib/server-db.server";

type Db = SupabaseClient<Database>;

const localPath = z
  .string()
  .regex(/^\/(?!\/)/)
  .max(200);

/** Om inloggning med BankID finns (visas på inloggningssidan). */
export const getBankIdAvailability = createServerFn({ method: "GET" }).handler(async () => ({
  configured: bankIdConfigured(),
}));

export type MyBankId = {
  linked: boolean;
  hint?: string;
  linked_at?: string;
  last_login_at?: string | null;
};

export const getMyBankId = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { data, error } = await supabase.rpc("my_bankid");
    if (error) throw new Error(error.message);
    return { configured: bankIdConfigured(), ...(data as MyBankId) };
  });

/** Kort biljett som låter /api/bankid/start koppla BankID till det inloggade kontot. */
export const createBankIdLinkTicket = createServerFn({ method: "POST" })
  .inputValidator(z.object({ back: localPath }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    if (!bankIdConfigured()) throw new Error("BankID är inte aktiverat ännu.");
    const ticket = sealState({ purpose: "link", uid: context.userId, back: data.back }, 300);
    return { url: `/api/bankid/start?ticket=${encodeURIComponent(ticket)}` };
  });

export const unlinkMyBankId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await (context.supabase as Db).rpc("unlink_my_bankid");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Förvaltningen: BankID-status för ett konto i organisationen. */
export const getMemberBankId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    await requirePermission(supabase, context.userId, "residents.view");
    const { data: rows, error } = await supabase.rpc("org_bankid_links", {
      _user_ids: [data.userId],
    });
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    return {
      configured: bankIdConfigured(),
      linked: !!row,
      hint: row?.hint ?? null,
      linkedAt: row?.linked_at ?? null,
      lastLoginAt: row?.last_login_at ?? null,
    };
  });

/**
 * Förvaltningen anger personnumret för ett konto, så att den boende kan
 * logga in med BankID direkt utan lösenord.
 */
export const linkMemberBankId = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string().uuid(), personnummer: z.string().max(20) }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "residents.edit");
    const secret = serverSecret();
    if (!bankIdConfigured() || !secret) throw new Error("BankID är inte aktiverat ännu.");
    const stored = personnummerForStorage(data.personnummer);
    if (!stored) throw new Error("Personnumret är inte giltigt. Skriv ÅÅÅÅMMDD-NNNN.");
    const { data: result, error } = await serverDb().rpc("link_bankid", {
      _secret: secret,
      _user_id: data.userId,
      _pnr_hash: stored.hash,
      _hint: stored.hint,
      _organization_id: orgId,
    });
    if (error) throw new Error(error.message);
    if (result === "taken") throw new Error("Personnumret är redan kopplat till ett annat konto.");
    if (result === "demo") throw new Error("Demokonton kan inte kopplas till BankID.");
    return { hint: stored.hint };
  });

export const unlinkMemberBankId = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    await requirePermission(supabase, context.userId, "residents.edit");
    const { error } = await supabase.rpc("unlink_member_bankid", { _user_id: data.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
