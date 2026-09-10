import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;

const STAFF_ROLES = ["super_admin", "org_admin", "property_manager", "board_member", "staff"];

async function loadMe(supabase: Db, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, organization_id")
    .eq("id", userId)
    .maybeSingle();

  const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (roleRows ?? []).map((r) => r.role as string);

  const { data: org } = profile?.organization_id
    ? await supabase
        .from("organizations")
        .select("id, name, org_type")
        .eq("id", profile.organization_id)
        .maybeSingle()
    : { data: null };

  const { data: residency } = await supabase
    .from("residencies")
    .select(
      "id, resident_name, move_in_date, tenure, unit_id, units(id, unit_number, object_number, address, size_sqm, rooms, floor, tenure, monthly_amount, storage, parking, balcony, key_count, building_id, buildings(id, name, property_id, properties(id, name, address, postal_code, city)))",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return {
    userId,
    profile,
    roles,
    isStaff: roles.some((r) => STAFF_ROLES.includes(r)),
    isContractor: roles.includes("contractor"),
    organization: org,
    residency,
  };
}

async function requireStaff(supabase: Db, userId: string) {
  const me = await loadMe(supabase, userId);
  if (!me.isStaff) throw new Error("Behörighet saknas");
  if (!me.profile?.organization_id) throw new Error("Ingen organisation");
  return { me, orgId: me.profile.organization_id };
}

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadMe(context.supabase as Db, context.userId));

/* ------------------------------- BOENDE ------------------------------- */

export const getResidentDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const me = await loadMe(supabase, context.userId);
    const unitId = me.residency?.unit_id ?? null;

    const [payment, requests, bookings, announcements, meetings] = await Promise.all([
      unitId
        ? supabase
            .from("payments")
            .select("*")
            .eq("unit_id", unitId)
            .order("period", { ascending: false })
            .limit(1)
        : Promise.resolve({ data: [] as never[] }),
      supabase
        .from("maintenance_requests")
        .select("id, ticket_number, title, status, priority, is_urgent, updated_at, category")
        .order("created_at", { ascending: false })
        .limit(4),
      supabase
        .from("bookings")
        .select("id, starts_at, ends_at, resources(name, icon, location)")
        .gte("ends_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(3),
      supabase
        .from("announcements")
        .select("id, title, body, category, published_at, is_pinned")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(3),
      supabase
        .from("meetings")
        .select("id, title, starts_at, location")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(2),
    ]);

    return {
      me,
      payment: payment.data?.[0] ?? null,
      requests: requests.data ?? [],
      bookings: bookings.data ?? [],
      announcements: announcements.data ?? [],
      meetings: meetings.data ?? [],
    };
  });

export const getMyHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const me = await loadMe(supabase, context.userId);
    const { data: documents } = await supabase
      .from("documents")
      .select("id, title, doc_type, file_kind, file_size, unit_id, created_at")
      .order("created_at", { ascending: false });
    return { me, documents: documents ?? [] };
  });

export const getMyRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { data } = await supabase
      .from("maintenance_requests")
      .select(
        "id, ticket_number, title, category, status, priority, is_urgent, room, created_at, updated_at, assignee_name",
      )
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const getRequestDetail = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const me = await loadMe(supabase, context.userId);
    const { data: request } = await supabase
      .from("maintenance_requests")
      .select(
        "*, units(unit_number, address), contractors(id, company, contact_name, phone, email)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!request) throw new Error("Ärendet hittades inte");
    const [events, comments] = await Promise.all([
      supabase
        .from("maintenance_events")
        .select("id, label, created_at")
        .eq("request_id", data.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("maintenance_comments")
        .select("id, author_name, author_role, body, created_at")
        .eq("request_id", data.id)
        .order("created_at", { ascending: true }),
    ]);
    return { me, request, events: events.data ?? [], comments: comments.data ?? [] };
  });

export const createRequest = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      category: string;
      title: string;
      description: string;
      room?: string;
      isUrgent: boolean;
    }) => d,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const me = await loadMe(supabase, context.userId);
    if (!me.profile?.organization_id) throw new Error("Ingen organisation");
    const { data: created, error } = await supabase
      .from("maintenance_requests")
      .insert({
        organization_id: me.profile.organization_id,
        unit_id: me.residency?.unit_id ?? null,
        reported_by: context.userId,
        reporter_name: me.profile.full_name ?? "Boende",
        category: data.category,
        title: data.title,
        description: data.description,
        room: data.room ?? null,
        is_urgent: data.isUrgent,
        priority: data.isUrgent ? "urgent" : "normal",
        status: "new",
      })
      .select("id, ticket_number")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("maintenance_events").insert({
      organization_id: me.profile.organization_id,
      request_id: created.id,
      label: "Felanmälan skickad",
    });
    return created;
  });

export const addRequestComment = createServerFn({ method: "POST" })
  .inputValidator((d: { requestId: string; body: string; action?: "still_broken" | "resolved" }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const me = await loadMe(supabase, context.userId);
    const orgId = me.profile?.organization_id;
    if (!orgId) throw new Error("Ingen organisation");

    if (data.body.trim()) {
      const { error } = await supabase.from("maintenance_comments").insert({
        organization_id: orgId,
        request_id: data.requestId,
        author_user_id: context.userId,
        author_name: me.profile?.full_name ?? "Boende",
        author_role: me.isStaff ? "staff" : "resident",
        body: data.body.trim(),
      });
      if (error) throw new Error(error.message);
    }

    if (data.action === "resolved") {
      await supabase
        .from("maintenance_requests")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", data.requestId);
      await supabase.from("maintenance_events").insert({
        organization_id: orgId,
        request_id: data.requestId,
        label: "Boende bekräftade att problemet är löst",
      });
    }
    if (data.action === "still_broken") {
      await supabase
        .from("maintenance_requests")
        .update({ status: "in_progress", resolved_at: null })
        .eq("id", data.requestId);
      await supabase.from("maintenance_events").insert({
        organization_id: orgId,
        request_id: data.requestId,
        label: "Boende meddelade att problemet kvarstår",
      });
    }
    return { ok: true };
  });

/* ------------------------------ BOKNINGAR ----------------------------- */

export const getResources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { data } = await supabase
      .from("resources")
      .select("*")
      .eq("is_active", true)
      .order("kind", { ascending: true });
    return data ?? [];
  });

export const getResourceDay = createServerFn({ method: "GET" })
  .inputValidator((d: { resourceId: string; date: string }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { data: resource } = await supabase
      .from("resources")
      .select("*")
      .eq("id", data.resourceId)
      .maybeSingle();
    if (!resource) throw new Error("Resursen hittades inte");
    const dayStart = new Date(`${data.date}T00:00:00`);
    const dayEnd = new Date(`${data.date}T23:59:59`);
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, starts_at, ends_at, booked_by_name, user_id, unit_id")
      .eq("resource_id", data.resourceId)
      .gte("starts_at", dayStart.toISOString())
      .lte("starts_at", dayEnd.toISOString());
    return { resource, bookings: bookings ?? [] };
  });

export const getMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { data } = await supabase
      .from("bookings")
      .select("id, starts_at, ends_at, status, resources(name, icon, location)")
      .eq("user_id", context.userId)
      .order("starts_at", { ascending: true });
    return data ?? [];
  });

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((d: { resourceId: string; startsAt: string; endsAt: string }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const me = await loadMe(supabase, context.userId);
    const orgId = me.profile?.organization_id;
    if (!orgId) throw new Error("Ingen organisation");

    const { data: resource } = await supabase
      .from("resources")
      .select("max_active_bookings, name")
      .eq("id", data.resourceId)
      .maybeSingle();

    const { data: active } = await supabase
      .from("bookings")
      .select("id")
      .eq("user_id", context.userId)
      .eq("resource_id", data.resourceId)
      .gte("ends_at", new Date().toISOString());
    if (resource && (active?.length ?? 0) >= resource.max_active_bookings) {
      throw new Error(
        `Du har redan ${resource.max_active_bookings} aktiva bokningar för ${resource.name}.`,
      );
    }

    const { error } = await supabase.from("bookings").insert({
      organization_id: orgId,
      resource_id: data.resourceId,
      unit_id: me.residency?.unit_id ?? null,
      user_id: context.userId,
      booked_by_name: me.profile?.full_name ?? "Boende",
      starts_at: data.startsAt,
      ends_at: data.endsAt,
    });
    if (error) throw new Error("Tiden är redan bokad.");
    return { ok: true };
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { error } = await supabase.from("bookings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------- INFORMATION, DOKUMENT, MÖTEN -------------------- */

export const getAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { data } = await supabase
      .from("announcements")
      .select("*, properties(name)")
      .eq("is_published", true)
      .order("published_at", { ascending: false });
    return data ?? [];
  });

export const getDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { data } = await supabase
      .from("documents")
      .select("*, properties(name), units(unit_number, address)")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const getMeetings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const [meetings, attendance] = await Promise.all([
      supabase.from("meetings").select("*").order("starts_at", { ascending: false }),
      supabase.from("meeting_attendance").select("meeting_id, status").eq("user_id", context.userId),
    ]);
    return { meetings: meetings.data ?? [], attendance: attendance.data ?? [] };
  });

export const setMeetingAttendance = createServerFn({ method: "POST" })
  .inputValidator((d: { meetingId: string; status: string }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const me = await loadMe(supabase, context.userId);
    const orgId = me.profile?.organization_id;
    if (!orgId) throw new Error("Ingen organisation");
    const { error } = await supabase.from("meeting_attendance").upsert(
      {
        organization_id: orgId,
        meeting_id: data.meetingId,
        user_id: context.userId,
        attendee_name: me.profile?.full_name ?? null,
        status: data.status,
      },
      { onConflict: "meeting_id,user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyEconomy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const me = await loadMe(supabase, context.userId);
    const { data } = await supabase
      .from("payments")
      .select("*")
      .order("period", { ascending: false })
      .limit(24);
    return { me, payments: data ?? [] };
  });

/* ------------------------------ MEDDELANDEN --------------------------- */

export const getMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const me = await loadMe(supabase, context.userId);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });
    return { me, messages: data ?? [] };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator((d: { threadKey: string; subject?: string; body: string; requestId?: string }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const me = await loadMe(supabase, context.userId);
    const orgId = me.profile?.organization_id;
    if (!orgId) throw new Error("Ingen organisation");
    const { error } = await supabase.from("messages").insert({
      organization_id: orgId,
      thread_key: data.threadKey,
      subject: data.subject ?? null,
      request_id: data.requestId ?? null,
      resident_user_id: me.isStaff ? null : context.userId,
      sender_user_id: context.userId,
      sender_name: me.profile?.full_name ?? "Boende",
      sender_role: me.isStaff ? "staff" : "resident",
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------ ADMIN -------------------------------- */

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { me, orgId } = await requireStaff(supabase, context.userId);

    const [units, requests, payments, bookings, drafts, resources, projects, meetings] =
      await Promise.all([
        supabase.from("units").select("id, status").eq("organization_id", orgId),
        supabase
          .from("maintenance_requests")
          .select("id, status, priority, is_urgent, created_at, resolved_at, category")
          .eq("organization_id", orgId),
        supabase
          .from("payments")
          .select("status, amount, period")
          .eq("organization_id", orgId)
          .eq("period", "2026-09-01"),
        supabase
          .from("bookings")
          .select("id, resource_id, starts_at")
          .eq("organization_id", orgId)
          .gte("starts_at", new Date(Date.now() - 30 * 864e5).toISOString()),
        supabase
          .from("announcements")
          .select("id, title")
          .eq("organization_id", orgId)
          .eq("is_published", false),
        supabase.from("resources").select("id, name, slot_minutes, open_from, open_to"),
        supabase.from("maintenance_projects").select("*").eq("organization_id", orgId),
        supabase
          .from("meetings")
          .select("id, title, starts_at")
          .gte("starts_at", new Date().toISOString())
          .order("starts_at", { ascending: true })
          .limit(1),
      ]);

    const reqs = requests.data ?? [];
    const open = reqs.filter((r) => !["resolved", "closed"].includes(r.status as string));
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const pays = payments.data ?? [];
    const paid = pays.filter((p) => p.status === "paid").length;

    const resolved = reqs.filter((r) => r.resolved_at);
    const avgDays =
      resolved.length > 0
        ? resolved.reduce(
            (sum, r) =>
              sum +
              (new Date(r.resolved_at as string).getTime() - new Date(r.created_at).getTime()) /
                864e5,
            0,
          ) / resolved.length
        : 0;

    const slotsPerDay = 8;
    const occupancy = (resources.data ?? []).map((res) => {
      const count = (bookings.data ?? []).filter((b) => b.resource_id === res.id).length;
      return {
        id: res.id,
        name: res.name,
        rate: Math.min(100, Math.round((count / (slotsPerDay * 30)) * 100 * 12)),
      };
    });

    const categories: Record<string, number> = {};
    reqs.forEach((r) => {
      categories[r.category] = (categories[r.category] ?? 0) + 1;
    });

    return {
      me,
      units: {
        total: units.data?.length ?? 0,
        active: (units.data ?? []).filter((u) => u.status === "active").length,
      },
      requests: {
        total: reqs.length,
        open: open.length,
        newToday: reqs.filter((r) => new Date(r.created_at) >= todayStart).length,
        urgent: open.filter((r) => r.priority === "urgent" || r.is_urgent).length,
        stale: open.filter((r) => Date.now() - new Date(r.created_at).getTime() > 7 * 864e5).length,
        avgResolutionDays: Math.round(avgDays * 10) / 10,
        categories,
      },
      economy: {
        paidShare: pays.length ? Math.round((paid / pays.length) * 1000) / 10 : 0,
        unpaid: pays.length - paid,
        billed: pays.reduce((s, p) => s + Number(p.amount), 0),
      },
      bookings: { occupancy },
      drafts: drafts.data ?? [],
      projects: projects.data ?? [],
      nextMeeting: meetings.data?.[0] ?? null,
    };
  });

export const getAdminRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    await requireStaff(supabase, context.userId);
    const { data } = await supabase
      .from("maintenance_requests")
      .select(
        "id, ticket_number, title, category, status, priority, is_urgent, assignee_name, created_at, reporter_name, units(unit_number, address), contractors(company)",
      )
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const updateRequestAdmin = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id: string;
      status?: string;
      priority?: string;
      assigneeName?: string | null;
      contractorId?: string | null;
      note?: string;
    }) => d,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { me, orgId } = await requireStaff(supabase, context.userId);

    const patch: Record<string, unknown> = {};
    if (data.status) patch["status"] = data.status;
    if (data.priority) patch["priority"] = data.priority;
    if (data.assigneeName !== undefined) patch["assignee_name"] = data.assigneeName;
    if (data.contractorId !== undefined) patch["contractor_id"] = data.contractorId;
    if (data.status === "resolved" || data.status === "closed")
      patch["resolved_at"] = new Date().toISOString();

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from("maintenance_requests").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
    }

    const labels: string[] = [];
    if (data.status) labels.push(`Status ändrad till ${data.status}`);
    if (data.priority) labels.push(`Prioritet ändrad till ${data.priority}`);
    if (data.assigneeName) labels.push(`Ansvarig: ${data.assigneeName}`);
    if (data.contractorId) {
      const { data: c } = await supabase
        .from("contractors")
        .select("company")
        .eq("id", data.contractorId)
        .maybeSingle();
      if (c) labels.push(`Entreprenör tilldelad: ${c.company}`);
    }
    for (const label of labels) {
      await supabase
        .from("maintenance_events")
        .insert({ organization_id: orgId, request_id: data.id, label });
    }
    if (data.note?.trim()) {
      await supabase.from("maintenance_comments").insert({
        organization_id: orgId,
        request_id: data.id,
        author_user_id: context.userId,
        author_name: me.profile?.full_name ?? "Administratör",
        author_role: "staff",
        body: data.note.trim(),
      });
    }
    return { ok: true };
  });

export const getAdminProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requireStaff(supabase, context.userId);
    const [properties, buildings, units] = await Promise.all([
      supabase.from("properties").select("*").eq("organization_id", orgId).order("address"),
      supabase.from("buildings").select("*").eq("organization_id", orgId),
      supabase
        .from("units")
        .select("id, unit_number, building_id, status, tenure, size_sqm, rooms, monthly_amount")
        .eq("organization_id", orgId),
    ]);
    return {
      properties: properties.data ?? [],
      buildings: buildings.data ?? [],
      units: units.data ?? [],
    };
  });

export const getAdminUnits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requireStaff(supabase, context.userId);
    const { data } = await supabase
      .from("units")
      .select(
        "id, unit_number, object_number, address, size_sqm, rooms, floor, tenure, monthly_amount, status, buildings(name)",
      )
      .eq("organization_id", orgId)
      .order("address")
      .order("unit_number")
      .limit(300);
    return data ?? [];
  });

export const getAdminResidents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requireStaff(supabase, context.userId);
    const { data } = await supabase
      .from("residencies")
      .select(
        "id, resident_name, email, phone, move_in_date, tenure, status, user_id, units(unit_number, address)",
      )
      .eq("organization_id", orgId)
      .order("resident_name")
      .limit(300);
    return data ?? [];
  });

export const getResidentDetail = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    await requireStaff(supabase, context.userId);
    const { data: residency } = await supabase
      .from("residencies")
      .select("*, units(*, buildings(name, properties(name, address)))")
      .eq("id", data.id)
      .maybeSingle();
    if (!residency) throw new Error("Boende hittades inte");
    const unitId = residency.unit_id;
    const [requests, payments, bookings, documents] = await Promise.all([
      supabase
        .from("maintenance_requests")
        .select("id, ticket_number, title, status, priority, created_at")
        .eq("unit_id", unitId)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("*")
        .eq("unit_id", unitId)
        .order("period", { ascending: false })
        .limit(12),
      supabase
        .from("bookings")
        .select("id, starts_at, ends_at, resources(name, icon)")
        .eq("unit_id", unitId)
        .order("starts_at", { ascending: false })
        .limit(10),
      supabase.from("documents").select("id, title, doc_type, file_kind").eq("unit_id", unitId),
    ]);
    return {
      residency,
      requests: requests.data ?? [],
      payments: payments.data ?? [],
      bookings: bookings.data ?? [],
      documents: documents.data ?? [],
    };
  });

export const getContractors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requireStaff(supabase, context.userId);
    const [contractors, requests] = await Promise.all([
      supabase.from("contractors").select("*").eq("organization_id", orgId).order("company"),
      supabase
        .from("maintenance_requests")
        .select("id, ticket_number, title, status, contractor_id")
        .eq("organization_id", orgId)
        .not("contractor_id", "is", null),
    ]);
    return { contractors: contractors.data ?? [], requests: requests.data ?? [] };
  });

export const saveContractor = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id?: string;
      company: string;
      contactName?: string;
      phone?: string;
      email?: string;
      category?: string;
      agreementNote?: string;
    }) => d,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requireStaff(supabase, context.userId);
    const row = {
      organization_id: orgId,
      company: data.company,
      contact_name: data.contactName ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      category: data.category ?? null,
      agreement_note: data.agreementNote ?? null,
    };
    const { error } = data.id
      ? await supabase.from("contractors").update(row).eq("id", data.id)
      : await supabase.from("contractors").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAdminAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requireStaff(supabase, context.userId);
    const [announcements, properties, buildings] = await Promise.all([
      supabase
        .from("announcements")
        .select("*, properties(name), buildings(name)")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      supabase.from("properties").select("id, name").eq("organization_id", orgId).order("name"),
      supabase.from("buildings").select("id, name, property_id").eq("organization_id", orgId),
    ]);
    return {
      announcements: announcements.data ?? [],
      properties: properties.data ?? [],
      buildings: buildings.data ?? [],
    };
  });

export const saveAnnouncement = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id?: string;
      title: string;
      body: string;
      category: string;
      audienceScope: string;
      propertyId?: string | null;
      buildingId?: string | null;
      publish: boolean;
    }) => d,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requireStaff(supabase, context.userId);
    const row = {
      organization_id: orgId,
      title: data.title,
      body: data.body,
      category: data.category,
      audience_scope: data.audienceScope,
      property_id: data.propertyId ?? null,
      building_id: data.buildingId ?? null,
      is_published: data.publish,
      published_at: data.publish ? new Date().toISOString() : null,
    };
    const { error } = data.id
      ? await supabase.from("announcements").update(row).eq("id", data.id)
      : await supabase.from("announcements").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publishAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; publish: boolean }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    await requireStaff(supabase, context.userId);
    const { error } = await supabase
      .from("announcements")
      .update({
        is_published: data.publish,
        published_at: data.publish ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAdminBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requireStaff(supabase, context.userId);
    const [resources, bookings] = await Promise.all([
      supabase.from("resources").select("*").eq("organization_id", orgId).order("name"),
      supabase
        .from("bookings")
        .select("id, starts_at, ends_at, booked_by_name, resource_id, units(unit_number, address)")
        .eq("organization_id", orgId)
        .gte("starts_at", new Date(Date.now() - 7 * 864e5).toISOString())
        .order("starts_at", { ascending: true }),
    ]);
    return { resources: resources.data ?? [], bookings: bookings.data ?? [] };
  });

export const updateResource = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id: string;
      slotMinutes: number;
      openFrom: string;
      openTo: string;
      maxActiveBookings: number;
      daysAhead: number;
      cancelHours: number;
      isActive: boolean;
    }) => d,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    await requireStaff(supabase, context.userId);
    const { error } = await supabase
      .from("resources")
      .update({
        slot_minutes: data.slotMinutes,
        open_from: data.openFrom,
        open_to: data.openTo,
        max_active_bookings: data.maxActiveBookings,
        days_ahead: data.daysAhead,
        cancel_hours: data.cancelHours,
        is_active: data.isActive,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAdminEconomy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requireStaff(supabase, context.userId);
    const { data } = await supabase
      .from("payments")
      .select("id, period, amount, status, due_date, kind, units(unit_number, address)")
      .eq("organization_id", orgId)
      .order("period", { ascending: false })
      .limit(1000);
    const rows = data ?? [];
    const byPeriod = new Map<string, { period: string; billed: number; paid: number; count: number; paidCount: number }>();
    rows.forEach((r) => {
      const key = r.period as string;
      const entry = byPeriod.get(key) ?? { period: key, billed: 0, paid: 0, count: 0, paidCount: 0 };
      entry.billed += Number(r.amount);
      entry.count += 1;
      if (r.status === "paid") {
        entry.paid += Number(r.amount);
        entry.paidCount += 1;
      }
      byPeriod.set(key, entry);
    });
    return {
      periods: [...byPeriod.values()].sort((a, b) => (a.period < b.period ? 1 : -1)),
      unpaid: rows.filter((r) => r.status !== "paid").slice(0, 50),
    };
  });

export const markPaymentPaid = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    await requireStaff(supabase, context.userId);
    const { error } = await supabase
      .from("payments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMaintenanceProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { data } = await supabase
      .from("maintenance_projects")
      .select("*, properties(name)")
      .order("year", { ascending: true });
    return data ?? [];
  });

export const saveMaintenanceProject = createServerFn({ method: "POST" })
  .inputValidator((d: { id?: string; title: string; year: number; status: string; note?: string }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requireStaff(supabase, context.userId);
    const row = {
      organization_id: orgId,
      title: data.title,
      year: data.year,
      status: data.status,
      note: data.note ?? null,
    };
    const { error } = data.id
      ? await supabase.from("maintenance_projects").update(row).eq("id", data.id)
      : await supabase.from("maintenance_projects").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAdminSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requireStaff(supabase, context.userId);
    const [org, profiles, roles, properties] = await Promise.all([
      supabase.from("organizations").select("*").eq("id", orgId).maybeSingle(),
      supabase.from("profiles").select("id, full_name, email").eq("organization_id", orgId),
      supabase.from("user_roles").select("user_id, role").eq("organization_id", orgId),
      supabase.from("properties").select("id").eq("organization_id", orgId),
    ]);
    return {
      organization: org.data,
      members: (profiles.data ?? []).map((p) => ({
        ...p,
        roles: (roles.data ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
      })),
      propertyCount: properties.data?.length ?? 0,
    };
  });
