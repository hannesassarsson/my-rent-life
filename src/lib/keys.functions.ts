import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { loadMe, requirePermission } from "@/lib/app.functions";

// Digitala nycklar. Behörigheten prövas i databasen (unlock_door), som också
// loggar passagen. I en riktig installation anropar servern därefter
// låsleverantörens API (t.ex. via läsarens reader_id) för att öppna dörren.

type Db = SupabaseClient<Database>;

const id = z.string().uuid();
const doorKind = z.enum([
  "entrance",
  "laundry",
  "garbage",
  "garage",
  "bike",
  "storage",
  "common",
  "other",
]);
export type DoorKind = z.infer<typeof doorKind>;

export type UnlockResult = {
  result: "granted" | "denied";
  reason: string;
  door: string;
  at: string;
};

async function requireKeysFeature(supabase: Db, userId: string) {
  const me = await loadMe(supabase, userId);
  if (!me.features.includes("keys")) throw new Error("Digitala nycklar ingår inte i er plan.");
  if (!me.profile?.organization_id) throw new Error("Ingen organisation");
  return { me, orgId: me.profile.organization_id };
}

/** Dörrarna den inloggade kan öppna, egna nycklar och senaste passager. */
export const getMyKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { me, orgId } = await requireKeysFeature(supabase, context.userId);
    const [doors, keys, events, propertyIds] = await Promise.all([
      supabase
        .from("access_doors")
        .select("id, name, location, kind, property_id, residents_access, is_online")
        .eq("organization_id", orgId)
        .order("name"),
      supabase
        .from("access_keys")
        .select("id, holder_name, door_ids, valid_from, valid_until, revoked_at, note")
        .eq("user_id", context.userId)
        .is("revoked_at", null),
      supabase
        .from("access_events")
        .select("id, door_id, result, reason, method, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase.rpc("my_property_ids", { _user_id: context.userId }),
    ]);
    if (doors.error) throw new Error(doors.error.message);

    const now = Date.now();
    const activeKeys = (keys.data ?? []).filter(
      (k) =>
        new Date(k.valid_from).getTime() <= now &&
        (!k.valid_until || new Date(k.valid_until).getTime() > now),
    );
    const myProperties = new Set((propertyIds.data ?? []) as string[]);
    const staff = me.permissions.includes("access.edit");

    return {
      doors: (doors.data ?? []).map((d) => {
        const key = activeKeys.find((k) => k.door_ids.includes(d.id));
        const via = staff
          ? "Personal"
          : key
            ? "Digital nyckel"
            : d.residents_access && d.property_id && myProperties.has(d.property_id)
              ? "Boende i fastigheten"
              : null;
        return { ...d, access: !!via, via, keyUntil: key?.valid_until ?? null };
      }),
      keys: activeKeys,
      events: events.data ?? [],
    };
  });

/** Försöker låsa upp en dörr, med NFC (länk från läsaren) eller knapp i appen. */
export const unlockDoor = createServerFn({ method: "POST" })
  .inputValidator(z.object({ doorId: id, method: z.enum(["nfc", "app"]) }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    await requireKeysFeature(supabase, context.userId);
    const { data: result, error } = await supabase.rpc("unlock_door", {
      _door_id: data.doorId,
      _method: data.method,
    });
    if (error) throw new Error(error.message);
    // Här skulle låsleverantörens API anropas när resultatet är "granted".
    return result as UnlockResult;
  });

export const getAccessAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { me, orgId } = await requirePermission(supabase, context.userId, "access.view");
    const [doors, keys, events, properties, people, contractors] = await Promise.all([
      supabase.from("access_doors").select("*").eq("organization_id", orgId).order("name"),
      supabase
        .from("access_keys")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      supabase
        .from("access_events")
        .select("id, door_id, holder_name, result, reason, method, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(150),
      supabase.from("properties").select("id, name").eq("organization_id", orgId).order("name"),
      supabase
        .from("residencies")
        .select("user_id, resident_name, units(unit_number)")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .not("user_id", "is", null)
        .order("resident_name"),
      supabase
        .from("contractors")
        .select("user_id, company, contact_name")
        .eq("organization_id", orgId)
        .not("user_id", "is", null),
    ]);
    if (doors.error) throw new Error(doors.error.message);
    const holders = [
      ...(people.data ?? []).map((p) => ({
        userId: p.user_id as string,
        name: `${p.resident_name ?? "Boende"}${p.units?.unit_number ? ` (${p.units.unit_number})` : ""}`,
        kind: "resident" as const,
      })),
      ...(contractors.data ?? []).map((c) => ({
        userId: c.user_id as string,
        name: `${c.company}${c.contact_name ? ` – ${c.contact_name}` : ""}`,
        kind: "contractor" as const,
      })),
    ];
    return {
      doors: doors.data ?? [],
      keys: keys.data ?? [],
      events: events.data ?? [],
      properties: properties.data ?? [],
      holders,
      canEdit: me.permissions.includes("access.edit"),
    };
  });

export const saveDoor = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: id.optional(),
      name: z.string().trim().min(1).max(120),
      location: z.string().trim().max(200).optional(),
      kind: doorKind,
      propertyId: id.nullable(),
      residentsAccess: z.boolean(),
      readerId: z.string().trim().max(100).optional(),
      isOnline: z.boolean(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "access.edit");
    const row = {
      organization_id: orgId,
      name: data.name,
      location: data.location || null,
      kind: data.kind,
      property_id: data.propertyId,
      residents_access: data.residentsAccess,
      reader_id: data.readerId || null,
      is_online: data.isOnline,
    };
    const { error } = data.id
      ? await supabase
          .from("access_doors")
          .update(row)
          .eq("id", data.id)
          .eq("organization_id", orgId)
      : await supabase.from("access_doors").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const issueKey = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: id.nullable(),
      holderName: z.string().trim().min(1).max(120),
      holderKind: z.enum(["resident", "staff", "contractor", "guest"]),
      doorIds: z.array(id).min(1, "Välj minst en dörr").max(50),
      validFrom: z.string().datetime({ offset: true }).optional(),
      validUntil: z.string().datetime({ offset: true }).nullable(),
      note: z.string().trim().max(300).optional(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "access.edit");
    if (data.validUntil && data.validFrom && data.validUntil <= data.validFrom) {
      throw new Error("Slutdatumet måste vara efter startdatumet.");
    }
    const { error } = await supabase.from("access_keys").insert({
      organization_id: orgId,
      user_id: data.userId,
      holder_name: data.holderName,
      holder_kind: data.holderKind,
      door_ids: data.doorIds,
      valid_from: data.validFrom ?? new Date().toISOString(),
      valid_until: data.validUntil,
      note: data.note || null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    if (data.userId) {
      const { error: notifyError } = await supabase.from("notifications").insert({
        organization_id: orgId,
        user_id: data.userId,
        title: "Du har fått en digital nyckel",
        body: data.validUntil
          ? `Nyckeln gäller till ${new Intl.DateTimeFormat("sv-SE", { dateStyle: "long", timeZone: "Europe/Stockholm" }).format(new Date(data.validUntil))}.`
          : "Nyckeln gäller tills vidare.",
        link: "/app/nycklar",
      });
      if (notifyError) console.error("Notis:", notifyError.message);
    }
    return { ok: true };
  });

export const revokeKey = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "access.edit");
    const { data: rows, error } = await supabase
      .from("access_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("organization_id", orgId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows?.length) throw new Error("Nyckeln hittades inte");
    return { ok: true };
  });
