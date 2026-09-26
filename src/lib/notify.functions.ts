import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { loadMe, requirePermission } from "@/lib/app.functions";
import {
  deliverQueued,
  emailConfigured,
  normalizePhone,
  smsConfigured,
} from "@/lib/delivery.server";

type Db = SupabaseClient<Database>;

async function orgDeliveryInfo(supabase: Db, orgId: string | null) {
  if (!orgId) return { smsEnabled: false, isDemo: false };
  const { data } = await supabase
    .from("organizations")
    .select("sms_enabled, subscriptions(is_demo)")
    .eq("id", orgId)
    .maybeSingle();
  return { smsEnabled: !!data?.sms_enabled, isDemo: !!data?.subscriptions?.is_demo };
}

/** Den inloggades kanalval för utskick. */
export const getMyNotificationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const me = await loadMe(supabase, context.userId);
    const [{ data: prefs }, org, { data: recent }] = await Promise.all([
      supabase
        .from("notification_prefs")
        .select("email_enabled, sms_enabled")
        .eq("user_id", context.userId)
        .maybeSingle(),
      orgDeliveryInfo(supabase, me.organization?.id ?? null),
      supabase
        .from("notification_deliveries")
        .select("id, channel, status, error, created_at, sent_at, notifications(title)")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    return {
      email: me.profile?.email ?? null,
      phone: me.profile?.phone ?? null,
      fullName: me.profile?.full_name ?? null,
      emailEnabled: prefs?.email_enabled ?? true,
      smsEnabled: prefs?.sms_enabled ?? false,
      orgSmsEnabled: org.smsEnabled,
      isDemo: org.isDemo,
      channels: { email: emailConfigured(), sms: smsConfigured() },
      recent: recent ?? [],
    };
  });

export const saveMyNotificationSettings = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      emailEnabled: z.boolean(),
      smsEnabled: z.boolean(),
      phone: z.string().trim().max(40),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const me = await loadMe(supabase, context.userId);
    const phone = data.phone ? normalizePhone(data.phone) : null;
    if (data.phone && !phone) throw new Error("Ange ett mobilnummer, t.ex. 070-123 45 67.");
    if (data.smsEnabled && !phone) throw new Error("Ange ditt mobilnummer för att få sms.");
    if (phone !== (me.profile?.phone ?? null)) {
      const fullName = me.profile?.full_name || me.profile?.email?.split("@")[0] || "Boende";
      const { error } = await supabase.rpc("update_my_contact", {
        _full_name: fullName,
        _phone: phone ?? "",
      });
      if (error) throw new Error(error.message);
    }
    const { error } = await supabase.from("notification_prefs").upsert({
      user_id: context.userId,
      email_enabled: data.emailEnabled,
      sms_enabled: data.smsEnabled,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true, phone };
  });

/** Skickar en testnotis till den inloggade på de kanaler den valt. */
export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const me = await loadMe(supabase, context.userId);
    const orgId = me.organization?.id;
    if (!orgId) throw new Error("Du tillhör ingen organisation.");
    const { data: notification, error } = await supabase
      .from("notifications")
      .insert({
        organization_id: orgId,
        user_id: context.userId,
        title: "Testutskick från Boendeplattformen",
        body: "Det här är ett test. Så här ser det ut när du får en avi, ett svar på en felanmälan eller ett meddelande.",
        link: "/app/meddelanden",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await deliverQueued();
    const { data: deliveries } = await supabase
      .from("notification_deliveries")
      .select("channel, status, recipient, error")
      .eq("notification_id", notification.id);
    return { deliveries: deliveries ?? [] };
  });

/** Utskicksloggen och föreningens inställningar, för administratörer. */
export const getDeliveryAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "settings.edit");
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const [org, { data: log, error }, { data: stats }, { data: members }] = await Promise.all([
      orgDeliveryInfo(supabase, orgId),
      supabase
        .from("notification_deliveries")
        .select(
          "id, user_id, channel, category, recipient, status, attempts, error, created_at, sent_at, notifications(title)",
        )
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("notification_deliveries")
        .select("channel, status")
        .eq("organization_id", orgId)
        .gte("created_at", since),
      supabase.from("profiles").select("id, full_name").eq("organization_id", orgId),
    ]);
    if (error) throw new Error(error.message);
    const names = new Map((members ?? []).map((m) => [m.id, m.full_name]));
    const count = (channel: string, status?: string) =>
      (stats ?? []).filter((s) => s.channel === channel && (!status || s.status === status)).length;
    return {
      smsEnabled: org.smsEnabled,
      isDemo: org.isDemo,
      channels: { email: emailConfigured(), sms: smsConfigured() },
      stats: {
        email: {
          total: count("email"),
          sent: count("email", "sent"),
          failed: count("email", "failed"),
        },
        sms: { total: count("sms"), sent: count("sms", "sent"), failed: count("sms", "failed") },
      },
      log: (log ?? []).map((d) => ({ ...d, name: names.get(d.user_id) ?? null })),
    };
  });

export const saveOrgDeliverySettings = createServerFn({ method: "POST" })
  .inputValidator(z.object({ smsEnabled: z.boolean() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const { orgId } = await requirePermission(supabase, context.userId, "settings.edit");
    const { error } = await supabase
      .from("organizations")
      .update({ sms_enabled: data.smsEnabled })
      .eq("id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
