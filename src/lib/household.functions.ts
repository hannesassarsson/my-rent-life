// Lägenheter, hushåll, inbjudningar och historik.
//
// En lägenhet har noll eller flera boende (residencies). Exakt en aktiv
// boende är primär; övriga är hushållsmedlemmar. Ett boende kan ha ett konto
// (user_id), som skapas via en inbjudningslänk. Länkens token finns bara i
// länken; databasen sparar en hash och avgör allt utifrån den.

import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { requirePermission } from "@/lib/app.functions";
import { emailConfigured, sendDirectEmail } from "@/lib/delivery.server";
import { dbError } from "@/lib/errors";
import { appUrl, serverDb, serviceAuthDb, userDb } from "@/lib/server-db.server";

type Db = SupabaseClient<Database>;

const id = z.string().uuid();
const shortText = z.string().trim().max(200);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ogiltigt datum");
const optionalEmail = z.union([z.literal(""), z.string().trim().email("Ogiltig e-post").max(200)]);
const token = z.string().min(20).max(200);

export type InvitationStatus = "valid" | "expired" | "revoked" | "used";

function invitationStatus(i: {
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
}): InvitationStatus {
  if (i.accepted_at) return "used";
  if (i.revoked_at) return "revoked";
  if (new Date(i.expires_at) < new Date()) return "expired";
  return "valid";
}

function hashToken(raw: string) {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function unitText(u: { unit_number: string; address: string } | null | undefined) {
  return u ? `${u.address}, lägenhet ${u.unit_number}` : "lägenheten";
}

/* ----------------------------- LÄGENHETER ----------------------------- */

/** Alla lägenheter med sina boende och väntande inbjudningar. */
export const getUnitRegistry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { me, orgId } = await requirePermission(supabase, context.userId, "residents.view");
    const canInvite = me.permissions.includes("residents.edit");
    const [units, residents, invitations] = await Promise.all([
      supabase
        .from("units")
        .select("id, unit_number, address, status, tenure, size_sqm, rooms, floor, buildings(name)")
        .eq("organization_id", orgId)
        .order("address")
        .order("unit_number")
        .limit(1000),
      supabase
        .from("residencies")
        .select("id, unit_id, resident_name, is_primary, user_id")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .limit(3000),
      canInvite
        ? supabase
            .from("invitations")
            .select("unit_id, accepted_at, revoked_at, expires_at")
            .eq("organization_id", orgId)
            .is("accepted_at", null)
            .is("revoked_at", null)
            .gt("expires_at", new Date().toISOString())
        : Promise.resolve({ data: [] as { unit_id: string }[] }),
    ]);
    const byUnit = new Map<string, { name: string; primary: boolean; account: boolean }[]>();
    for (const r of residents.data ?? []) {
      const list = byUnit.get(r.unit_id) ?? [];
      list.push({ name: r.resident_name, primary: r.is_primary, account: !!r.user_id });
      byUnit.set(r.unit_id, list);
    }
    const pending = new Map<string, number>();
    for (const i of invitations.data ?? [])
      pending.set(i.unit_id, (pending.get(i.unit_id) ?? 0) + 1);
    return (units.data ?? []).map((u) => ({
      ...u,
      residents: (byUnit.get(u.id) ?? []).sort((a, b) => Number(b.primary) - Number(a.primary)),
      pendingInvitations: pending.get(u.id) ?? 0,
    }));
  });

/** En lägenhet med hushåll, inbjudningar och historik. */
export const getUnitDetail = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { me, orgId } = await requirePermission(supabase, context.userId, "residents.view");
    const { data: unit } = await supabase
      .from("units")
      .select("*, buildings(name, properties(name, address, postal_code, city))")
      .eq("id", data.id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!unit) throw new Error("Lägenheten hittades inte.");
    const canEdit = me.permissions.includes("residents.edit");
    const [residents, invitations, history, otherUnits] = await Promise.all([
      supabase
        .from("residencies")
        .select(
          "id, resident_name, email, phone, is_primary, status, user_id, move_in_date, move_out_date, tenure",
        )
        .eq("unit_id", unit.id)
        .order("status")
        .order("is_primary", { ascending: false })
        .order("resident_name"),
      canEdit
        ? supabase
            .from("invitations")
            .select(
              "id, residency_id, invitee_name, invitee_email, created_at, expires_at, sent_at, accepted_at, revoked_at",
            )
            .eq("unit_id", unit.id)
            .order("created_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
      supabase
        .from("audit_events")
        .select("id, actor_name, summary, created_at")
        .eq("unit_id", unit.id)
        .order("created_at", { ascending: false })
        .limit(30),
      canEdit
        ? supabase
            .from("units")
            .select("id, unit_number, address")
            .eq("organization_id", orgId)
            .neq("id", unit.id)
            .order("address")
            .order("unit_number")
            .limit(1000)
        : Promise.resolve({ data: [] }),
    ]);
    const residentNames = new Map((residents.data ?? []).map((r) => [r.id, r.resident_name]));
    return {
      unit,
      canEdit,
      emailAvailable: emailConfigured(),
      residents: residents.data ?? [],
      invitations: (invitations.data ?? []).map((i) => ({
        ...i,
        status: invitationStatus(i),
        name: i.invitee_name ?? (i.residency_id ? residentNames.get(i.residency_id) : null) ?? null,
      })),
      history: history.data ?? [],
      otherUnits: otherUnits.data ?? [],
    };
  });

/* ------------------------------- HUSHÅLL ------------------------------- */

async function unitInOrg(supabase: Db, unitId: string, orgId: string) {
  const { data } = await supabase
    .from("units")
    .select("id, unit_number, address, tenure, status")
    .eq("id", unitId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!data) throw new Error("Lägenheten hittades inte.");
  return data;
}

async function activeResidents(supabase: Db, unitId: string) {
  const { data } = await supabase
    .from("residencies")
    .select("id, is_primary")
    .eq("unit_id", unitId)
    .eq("status", "active");
  return data ?? [];
}

/** Lägg till en boende i en lägenhet – som primär boende eller hushållsmedlem. */
export const addResident = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      unitId: id,
      residentName: shortText.min(1, "Fyll i namnet"),
      email: optionalEmail,
      phone: z.string().trim().max(40),
      tenure: z.enum(["owned", "rented"]),
      moveInDate: isoDate,
      isPrimary: z.boolean(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "residents.edit");
    const unit = await unitInOrg(supabase, data.unitId, orgId);
    const current = await activeResidents(supabase, unit.id);
    // Den första boende blir alltid primär.
    const isPrimary = data.isPrimary || current.length === 0;
    if (isPrimary && current.some((r) => r.is_primary)) {
      const { error } = await supabase
        .from("residencies")
        .update({ is_primary: false })
        .eq("unit_id", unit.id)
        .eq("status", "active");
      if (error) throw dbError(error);
    }
    const { data: created, error } = await supabase
      .from("residencies")
      .insert({
        organization_id: orgId,
        unit_id: unit.id,
        resident_name: data.residentName,
        email: data.email || null,
        phone: data.phone || null,
        tenure: data.tenure,
        move_in_date: data.moveInDate,
        is_primary: isPrimary,
      })
      .select("id")
      .single();
    if (error) throw dbError(error);
    if (unit.status !== "active") {
      await supabase.from("units").update({ status: "active" }).eq("id", unit.id);
    }
    return { id: created.id };
  });

/** Gör en boende till primär boende; övriga i hushållet blir hushållsmedlemmar. */
export const setPrimaryResident = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "residents.edit");
    const { data: r } = await supabase
      .from("residencies")
      .select("id, unit_id, status")
      .eq("id", data.id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!r || r.status !== "active") throw new Error("Personen bor inte längre i lägenheten.");
    const clear = await supabase
      .from("residencies")
      .update({ is_primary: false })
      .eq("unit_id", r.unit_id)
      .eq("status", "active")
      .neq("id", r.id);
    if (clear.error) throw dbError(clear.error);
    const set = await supabase.from("residencies").update({ is_primary: true }).eq("id", r.id);
    if (set.error) throw dbError(set.error);
    return { ok: true };
  });

/** Flytta en boende (och ett kopplat konto) till en annan lägenhet i föreningen. */
export const moveResident = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id, unitId: id, moveInDate: isoDate }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "residents.edit");
    const { data: r } = await supabase
      .from("residencies")
      .select("id, unit_id, status, is_primary")
      .eq("id", data.id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!r || r.status !== "active") throw new Error("Personen bor inte längre i lägenheten.");
    if (r.unit_id === data.unitId) throw new Error("Personen bor redan i den lägenheten.");
    const target = await unitInOrg(supabase, data.unitId, orgId);
    const targetResidents = await activeResidents(supabase, target.id);

    const { error } = await supabase
      .from("residencies")
      .update({
        unit_id: target.id,
        move_in_date: data.moveInDate,
        is_primary: targetResidents.length === 0,
        tenure: target.tenure,
      })
      .eq("id", r.id);
    if (error) throw dbError(error);

    // Den gamla lägenheten: ny primär boende eller markeras som ledig.
    const left = await activeResidents(supabase, r.unit_id);
    if (left.length === 0) {
      await supabase.from("units").update({ status: "vacant" }).eq("id", r.unit_id);
    } else if (r.is_primary && !left.some((x) => x.is_primary)) {
      await supabase.from("residencies").update({ is_primary: true }).eq("id", left[0]!.id);
    }
    if (target.status !== "active") {
      await supabase.from("units").update({ status: "active" }).eq("id", target.id);
    }
    return { ok: true };
  });

/* ----------------------------- INBJUDNINGAR ----------------------------- */

export const createInvitation = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      unitId: id,
      residencyId: id.optional(),
      name: shortText,
      email: optionalEmail,
      sendEmail: z.boolean(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { me, orgId } = await requirePermission(supabase, context.userId, "residents.edit");
    const unit = await unitInOrg(supabase, data.unitId, orgId);

    let name = data.name || null;
    let email = data.email || null;
    if (data.residencyId) {
      const { data: r } = await supabase
        .from("residencies")
        .select("id, resident_name, email, user_id, unit_id, status")
        .eq("id", data.residencyId)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (!r || r.unit_id !== unit.id || r.status !== "active") {
        throw new Error("Personen bor inte i lägenheten.");
      }
      if (r.user_id) throw new Error("Personen har redan ett konto.");
      name = name ?? r.resident_name;
      email = email ?? r.email;
      // En ny länk ersätter tidigare länkar till samma person.
      await supabase
        .from("invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("residency_id", r.id)
        .is("accepted_at", null)
        .is("revoked_at", null);
    }

    const raw = randomBytes(32).toString("base64url");
    const { data: created, error } = await supabase
      .from("invitations")
      .insert({
        organization_id: orgId,
        unit_id: unit.id,
        residency_id: data.residencyId ?? null,
        invitee_name: data.residencyId ? null : name,
        invitee_email: data.residencyId ? null : email,
        token_hash: hashToken(raw),
        created_by: context.userId,
      })
      .select("id, expires_at")
      .single();
    if (error) throw dbError(error);

    const link = `${appUrl()}/invite/${raw}`;
    let emailed = false;
    let emailError: string | null = null;
    if (data.sendEmail) {
      if (!email) {
        emailError = "Ingen e-postadress angavs.";
      } else {
        const orgName = me.organization?.name ?? "Föreningen";
        const sent = await sendDirectEmail(email, {
          title: `Välkommen till ${orgName} på Boendeplattformen`,
          body:
            `Hej${name ? ` ${name}` : ""}!\n\n` +
            `Du har blivit inbjuden till ${unitText(unit)}. ` +
            "Skapa ditt konto med knappen nedan för att se information från föreningen, boka tvättstugan och göra felanmälningar.\n\n" +
            "Länken gäller i 14 dagar och kan bara användas en gång.",
          link: `/invite/${raw}`,
          organizationName: orgName,
          button: "Skapa ditt konto",
          invitation: true,
        });
        if (sent.ok) {
          emailed = true;
          await supabase
            .from("invitations")
            .update({ sent_at: new Date().toISOString() })
            .eq("id", created.id);
        } else {
          emailError = sent.error;
        }
      }
    }
    return { id: created.id, link, expiresAt: created.expires_at, emailed, emailError };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "residents.edit");
    const { data: rows, error } = await supabase
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("organization_id", orgId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("id");
    if (error) throw dbError(error);
    if (!rows?.length) throw new Error("Inbjudan är redan använd eller återkallad.");
    return { ok: true };
  });

/* ------------------------------- HISTORIK ------------------------------- */

export const getAuditLog = createServerFn({ method: "GET" })
  .inputValidator(z.object({ before: z.string().datetime().optional() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "audit.view");
    let query = supabase
      .from("audit_events")
      .select("id, actor_name, action, summary, unit_id, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.before) query = query.lt("created_at", data.before);
    const { data: rows, error } = await query;
    if (error) throw dbError(error);
    return rows ?? [];
  });

/* ---------------------- FÖR DEN SOM ÄR INBJUDEN ---------------------- */

export type InvitationPreview = {
  status: InvitationStatus | "not_found";
  organization_name?: string;
  organization_type?: string;
  address?: string;
  unit_number?: string;
  invitee_name?: string | null;
  invitee_email?: string | null;
  expires_at?: string;
  is_demo?: boolean;
};

export type AcceptedInvitation = {
  organization_name: string;
  address: string;
  unit_number: string;
  resident_name: string;
  welcome_message: string | null;
};

/** Vad en inbjudningslänk gäller. Kräver ingen inloggning. */
export const getInvitation = createServerFn({ method: "GET" })
  .inputValidator(z.object({ token }))
  .handler(async ({ data }) => {
    const { data: preview, error } = await serverDb().rpc("invitation_preview", {
      _token: data.token,
    });
    if (error)
      throw dbError(error, "Vi kunde inte läsa inbjudan just nu. Försök igen om en stund.");
    return preview as InvitationPreview;
  });

/** Den inloggade användaren tar emot inbjudan. */
export const acceptInvitation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token, fullName: shortText }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { data: accepted, error } = await supabase.rpc("accept_invitation", {
      _token: data.token,
      _full_name: data.fullName,
    });
    if (error) throw dbError(error);
    return accepted as AcceptedInvitation;
  });

/**
 * Skapar ett konto åt den inbjudna och tar emot inbjudan i samma steg.
 * Svarar med en session som webbläsaren loggar in med.
 */
export const registerWithInvitation = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token,
      fullName: shortText.min(1, "Fyll i ditt namn"),
      email: z.string().trim().toLowerCase().email("Fyll i en giltig e-postadress").max(200),
      password: z.string().min(8, "Lösenordet behöver vara minst 8 tecken").max(200),
    }),
  )
  .handler(async ({ data }) => {
    const anon = serverDb();
    const { data: preview } = await anon.rpc("invitation_preview", { _token: data.token });
    const p = (preview ?? { status: "not_found" }) as InvitationPreview;
    if (p.status === "not_found") throw new Error("Inbjudan finns inte. Kontrollera länken.");
    if (p.status === "used") throw new Error("Inbjudan har redan använts.");
    if (p.status === "revoked" || p.status === "expired") {
      throw new Error("Inbjudan gäller inte längre. Be styrelsen om en ny länk.");
    }
    if (p.is_demo) {
      throw new Error("Det här är en demoförening. Inbjudan kan visas men inte användas.");
    }

    const admin = serviceAuthDb();
    if (!admin) throw new Error("Det går inte att skapa konton just nu. Kontakta styrelsen.");
    const { error: createError } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createError) {
      if (/already|registered|exists/i.test(createError.message)) {
        throw new Error(
          "Det finns redan ett konto med den e-postadressen. Logga in för att ta emot inbjudan.",
        );
      }
      if (/password/i.test(createError.message)) {
        throw new Error("Välj ett längre eller svårare lösenord (minst 8 tecken).");
      }
      console.error(`Skapa konto: ${createError.message}`);
      throw new Error("Kontot kunde inte skapas just nu. Försök igen om en stund.");
    }

    const { data: auth, error: signInError } = await anon.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (signInError || !auth.session) {
      throw new Error("Kontot är skapat. Logga in med din e-post och ditt lösenord.");
    }
    const { data: accepted, error } = await userDb(auth.session.access_token).rpc(
      "accept_invitation",
      { _token: data.token, _full_name: data.fullName },
    );
    if (error) throw dbError(error);
    return {
      accessToken: auth.session.access_token,
      refreshToken: auth.session.refresh_token,
      accepted: accepted as AcceptedInvitation,
    };
  });
