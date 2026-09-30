import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { requirePermission } from "@/lib/app.functions";
import { deliverQueued } from "@/lib/delivery.server";
import { dbError } from "@/lib/errors";

// Skapa, ändra och ta bort det som administratören sköter: entreprenörer,
// underhållsprojekt, bokningsbara resurser, dörrar, fastigheter, hus och
// lägenheter. Varje funktion prövar behörigheten och att raden hör till den
// egna organisationen; databasens radregler är ett andra skydd.

type Db = SupabaseClient<Database>;

const id = z.string().uuid();
const byId = z.object({ id });
const name = z.string().trim().min(1).max(120);
const optionalText = z.string().trim().max(200).optional();

/** "3 oktober kl. 16:00–18:00" i svensk tid, oavsett serverns tidszon. */
function when(start: string, end: string) {
  const tz = { timeZone: "Europe/Stockholm" } as const;
  const day = new Intl.DateTimeFormat("sv-SE", { ...tz, day: "numeric", month: "long" });
  const time = new Intl.DateTimeFormat("sv-SE", { ...tz, hour: "2-digit", minute: "2-digit" });
  return `${day.format(new Date(start))} kl. ${time.format(new Date(start))}–${time.format(new Date(end))}`;
}

/** Tar bort en rad i organisationen; felar begripligt om den redan är borta. */
async function deleteOwned(
  supabase: Db,
  table:
    | "contractors"
    | "maintenance_projects"
    | "resources"
    | "access_doors"
    | "properties"
    | "buildings"
    | "units",
  rowId: string,
  orgId: string,
  missing: string,
) {
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq("id", rowId)
    .eq("organization_id", orgId)
    .select("id");
  if (error) throw dbError(error);
  if (!data?.length) throw new Error(missing);
}

async function countRows(
  supabase: Db,
  table: "buildings" | "units" | "residencies" | "payments" | "maintenance_requests" | "documents",
  column: string,
  value: string,
) {
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);
  return count ?? 0;
}

async function notifyUsers(
  supabase: Db,
  orgId: string,
  rows: { userId: string; title: string; body: string; link: string }[],
) {
  if (rows.length === 0) return;
  await supabase.from("notifications").insert(
    rows.map((r) => ({
      organization_id: orgId,
      user_id: r.userId,
      title: r.title,
      body: r.body,
      link: r.link,
    })),
  );
  await deliverQueued();
}

/* ----------------------------- ENTREPRENÖRER ----------------------------- */

export const deleteContractor = createServerFn({ method: "POST" })
  .inputValidator(byId)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "contractors.edit");
    // Ärenden som entreprenören hade står kvar utan entreprenör (on delete set null).
    await deleteOwned(supabase, "contractors", data.id, orgId, "Entreprenören finns inte längre.");
    return { ok: true };
  });

/* ----------------------------- UNDERHÅLLSPLAN ---------------------------- */

export const deleteMaintenanceProject = createServerFn({ method: "POST" })
  .inputValidator(byId)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "maintenance.edit");
    await deleteOwned(
      supabase,
      "maintenance_projects",
      data.id,
      orgId,
      "Projektet finns inte längre.",
    );
    return { ok: true };
  });

/* ------------------------------- BOKNINGAR ------------------------------- */

const resourceKind = z.enum([
  "laundry",
  "sauna",
  "guest_room",
  "party_room",
  "hobby",
  "parking",
  "ev_charger",
]);
export type ResourceKind = z.infer<typeof resourceKind>;

const RESOURCE_ICONS: Record<ResourceKind, string> = {
  laundry: "🧺",
  sauna: "🧖",
  guest_room: "🛏️",
  party_room: "🎉",
  hobby: "🛠️",
  parking: "🅿️",
  ev_charger: "🔌",
};

export const createResource = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name,
      kind: resourceKind,
      location: optionalText,
      propertyId: id.nullable(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "bookings.edit");
    const hourly = data.kind === "sauna" || data.kind === "ev_charger";
    const { data: created, error } = await supabase
      .from("resources")
      .insert({
        organization_id: orgId,
        name: data.name,
        kind: data.kind,
        icon: RESOURCE_ICONS[data.kind],
        location: data.location || null,
        property_id: data.propertyId,
        slot_minutes: hourly ? 60 : 120,
      })
      .select("id")
      .single();
    if (error) throw dbError(error);
    return { id: created.id };
  });

export const deleteResource = createServerFn({ method: "POST" })
  .inputValidator(byId)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "bookings.edit");
    const { data: resource } = await supabase
      .from("resources")
      .select("name")
      .eq("id", data.id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!resource) throw new Error("Resursen finns inte längre.");
    // De som har kommande bokningar får veta att de är avbokade.
    const { data: upcoming } = await supabase
      .from("bookings")
      .select("user_id, starts_at, ends_at")
      .eq("resource_id", data.id)
      .gte("starts_at", new Date().toISOString());
    await deleteOwned(supabase, "resources", data.id, orgId, "Resursen finns inte längre.");
    await notifyUsers(
      supabase,
      orgId,
      (upcoming ?? [])
        .filter((b) => b.user_id)
        .map((b) => ({
          userId: b.user_id as string,
          title: `Din bokning av ${resource.name} är avbokad`,
          body: `Bokningen ${when(b.starts_at, b.ends_at)} är avbokad eftersom ${resource.name} inte längre går att boka.`,
          link: "/app/bokningar",
        })),
    );
    return { ok: true, cancelled: upcoming?.length ?? 0 };
  });

export const adminCancelBooking = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id, reason: z.string().trim().max(300).optional() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "bookings.edit");
    const { data: booking, error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", orgId)
      .select("user_id, starts_at, ends_at, resources(name)")
      .maybeSingle();
    if (error) throw dbError(error);
    if (!booking) throw new Error("Bokningen finns inte längre.");
    if (booking.user_id && booking.user_id !== context.userId) {
      const what = booking.resources?.name ?? "Bokningen";
      await notifyUsers(supabase, orgId, [
        {
          userId: booking.user_id,
          title: `Din bokning av ${what} är avbokad`,
          body:
            `Bokningen ${when(booking.starts_at, booking.ends_at)} är avbokad av föreningen.` +
            (data.reason ? ` ${data.reason}` : " Kontakta föreningen om du har frågor."),
          link: "/app/bokningar",
        },
      ]);
    }
    return { ok: true };
  });

/* -------------------------------- DÖRRAR -------------------------------- */

export const deleteDoor = createServerFn({ method: "POST" })
  .inputValidator(byId)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "access.edit");
    await deleteOwned(supabase, "access_doors", data.id, orgId, "Dörren finns inte längre.");
    // Nycklar som gällde dörren pekar inte längre på den.
    const { data: keys } = await supabase
      .from("access_keys")
      .select("id, door_ids")
      .eq("organization_id", orgId)
      .contains("door_ids", [data.id]);
    for (const k of keys ?? []) {
      await supabase
        .from("access_keys")
        .update({ door_ids: k.door_ids.filter((d) => d !== data.id) })
        .eq("id", k.id);
    }
    return { ok: true };
  });

/* ------------------------ FASTIGHETER, HUS, LÄGENHETER ------------------- */

export const saveProperty = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: id.optional(),
      name,
      address: name,
      postalCode: z.string().trim().max(10).optional(),
      city: z.string().trim().max(80).optional(),
      buildYear: z.number().int().min(1600).max(2200).nullable(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "properties.edit");
    const row = {
      organization_id: orgId,
      name: data.name,
      address: data.address,
      postal_code: data.postalCode || null,
      city: data.city || null,
      build_year: data.buildYear,
    };
    if (data.id) {
      const { data: rows, error } = await supabase
        .from("properties")
        .update(row)
        .eq("id", data.id)
        .eq("organization_id", orgId)
        .select("id");
      if (error) throw dbError(error);
      if (!rows?.length) throw new Error("Fastigheten finns inte längre.");
      return { id: data.id };
    }
    const { data: created, error } = await supabase
      .from("properties")
      .insert(row)
      .select("id")
      .single();
    if (error) throw dbError(error);
    // En ny fastighet får ett första hus, så att lägenheter kan läggas till direkt.
    await supabase
      .from("buildings")
      .insert({ organization_id: orgId, property_id: created.id, name: data.address });
    return { id: created.id };
  });

export const deleteProperty = createServerFn({ method: "POST" })
  .inputValidator(byId)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "properties.edit");
    const { data: buildings } = await supabase
      .from("buildings")
      .select("id")
      .eq("property_id", data.id)
      .eq("organization_id", orgId);
    for (const b of buildings ?? []) {
      if ((await countRows(supabase, "units", "building_id", b.id)) > 0) {
        throw new Error("Fastigheten har lägenheter. Ta bort lägenheterna först.");
      }
    }
    await deleteOwned(supabase, "properties", data.id, orgId, "Fastigheten finns inte längre.");
    return { ok: true };
  });

export const saveBuilding = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: id.optional(),
      propertyId: id,
      name,
      floors: z.number().int().min(0).max(200).nullable(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "properties.edit");
    const { data: property } = await supabase
      .from("properties")
      .select("id")
      .eq("id", data.propertyId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!property) throw new Error("Fastigheten finns inte i föreningen.");
    const row = {
      organization_id: orgId,
      property_id: data.propertyId,
      name: data.name,
      floors: data.floors,
    };
    const { error } = data.id
      ? await supabase.from("buildings").update(row).eq("id", data.id).eq("organization_id", orgId)
      : await supabase.from("buildings").insert(row);
    if (error) throw dbError(error);
    return { ok: true };
  });

export const deleteBuilding = createServerFn({ method: "POST" })
  .inputValidator(byId)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "properties.edit");
    if ((await countRows(supabase, "units", "building_id", data.id)) > 0) {
      throw new Error("Huset har lägenheter. Ta bort lägenheterna först.");
    }
    await deleteOwned(supabase, "buildings", data.id, orgId, "Huset finns inte längre.");
    return { ok: true };
  });

const tenure = z.enum(["owned", "rented"]);

export const createUnit = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      buildingId: id,
      unitNumber: z.string().trim().min(1).max(20),
      objectNumber: z.string().trim().max(40).optional(),
      address: name,
      floor: z.number().int().min(-5).max(200).nullable(),
      sizeSqm: z.number().min(1).max(10_000).nullable(),
      rooms: z.number().min(0).max(100).nullable(),
      tenure,
      monthlyAmount: z.number().min(0).max(1_000_000).nullable(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "properties.edit");
    const { data: building } = await supabase
      .from("buildings")
      .select("id")
      .eq("id", data.buildingId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!building) throw new Error("Huset finns inte i föreningen.");
    const { data: duplicate } = await supabase
      .from("units")
      .select("id")
      .eq("building_id", data.buildingId)
      .eq("unit_number", data.unitNumber)
      .maybeSingle();
    if (duplicate) throw new Error(`Lägenhet ${data.unitNumber} finns redan i huset.`);
    const { data: created, error } = await supabase
      .from("units")
      .insert({
        organization_id: orgId,
        building_id: data.buildingId,
        unit_number: data.unitNumber,
        object_number: data.objectNumber || null,
        address: data.address,
        floor: data.floor,
        size_sqm: data.sizeSqm,
        rooms: data.rooms,
        tenure: data.tenure,
        monthly_amount: data.monthlyAmount,
        status: "vacant",
      })
      .select("id")
      .single();
    if (error) throw dbError(error);
    return { id: created.id };
  });

export const deleteUnit = createServerFn({ method: "POST" })
  .inputValidator(byId)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "properties.edit");
    // En lägenhet med historik (boende, avgifter, ärenden, dokument) tas inte
    // bort, eftersom historiken då skulle försvinna med den.
    const checks = [
      ["residencies", "Lägenheten har eller har haft boende."],
      ["payments", "Lägenheten har avgifter eller hyror registrerade."],
      ["maintenance_requests", "Lägenheten har felanmälningar."],
      ["documents", "Lägenheten har dokument."],
    ] as const;
    for (const [table, reason] of checks) {
      if ((await countRows(supabase, table, "unit_id", data.id)) > 0) {
        throw new Error(`${reason} Ändra status till Ledig i stället för att ta bort den.`);
      }
    }
    await deleteOwned(supabase, "units", data.id, orgId, "Lägenheten finns inte längre.");
    return { ok: true };
  });

/* -------------------------------- EKONOMI -------------------------------- */

export const markPaymentUnpaid = createServerFn({ method: "POST" })
  .inputValidator(byId)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "economy.edit");
    const { data: rows, error } = await supabase
      .from("payments")
      .update({ status: "unpaid", paid_at: null, paid_via: null })
      .eq("id", data.id)
      .eq("organization_id", orgId)
      .eq("paid_via", "manual")
      .select("id");
    if (error) throw dbError(error);
    if (!rows?.length) {
      throw new Error("Bara betalningar som markerats som betalda för hand kan ångras.");
    }
    return { ok: true };
  });

/* -------------------------------- DOKUMENT ------------------------------- */

export const updateDocument = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id,
      title: z.string().trim().min(1).max(200),
      docType: z.string().trim().min(1).max(40),
      scope: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("organization") }),
        z.object({ kind: z.literal("property"), propertyId: id }),
        z.object({ kind: z.literal("unit"), unitId: id }),
      ]),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "documents.edit");
    if (data.scope.kind === "property") {
      const { data: p } = await supabase
        .from("properties")
        .select("id")
        .eq("id", data.scope.propertyId)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (!p) throw new Error("Fastigheten finns inte i föreningen.");
    }
    if (data.scope.kind === "unit") {
      const { data: u } = await supabase
        .from("units")
        .select("id")
        .eq("id", data.scope.unitId)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (!u) throw new Error("Lägenheten finns inte i föreningen.");
    }
    const { data: rows, error } = await supabase
      .from("documents")
      .update({
        title: data.title,
        doc_type: data.docType,
        property_id: data.scope.kind === "property" ? data.scope.propertyId : null,
        unit_id: data.scope.kind === "unit" ? data.scope.unitId : null,
      })
      .eq("id", data.id)
      .eq("organization_id", orgId)
      .select("id");
    if (error) throw dbError(error);
    if (!rows?.length) throw new Error("Dokumentet finns inte längre.");
    return { ok: true };
  });

/* -------------------------------- KONTON -------------------------------- */

export const removeMember = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: id }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    await requirePermission(supabase, context.userId, "settings.edit");
    const { error } = await supabase.rpc("remove_member", { _user_id: data.userId });
    if (error) throw dbError(error);
    return { ok: true };
  });
