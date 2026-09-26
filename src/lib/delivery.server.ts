// Utskick av notiser på e-post och sms. Nycklarna finns bara som
// miljövariabler på servern; en kanal utan nyckel är avstängd.
//
//   RESEND_API_KEY ............ e-post via Resend
//   EMAIL_FROM ................ avsändare, t.ex. "BRF Solbacken <info@boendeplattformen.se>"
//                               (domänen verifieras i Resend)
//   ELKS_API_USERNAME/PASSWORD  sms via 46elks
//   SMS_FROM .................. avsändarnamn på sms, högst 11 bokstäver/siffror
//   BILLING_SECRET ............ serverns hemlighet mot databasen
//   APP_URL ................... adressen i länkarna (annars Vercels produktionsadress)
//
// Notiser köas i databasen (notification_deliveries) när de skapas. Servern
// skickar kön direkt efter en åtgärd som skapat notiser, och därutöver
// med jämna mellanrum så att omförsök blir av.

import { appUrl, serverDb, serverSecret } from "@/lib/server-db.server";

export type Channel = "email" | "sms";

export function emailConfigured() {
  return !!process.env["RESEND_API_KEY"];
}

export function smsConfigured() {
  return !!process.env["ELKS_API_USERNAME"] && !!process.env["ELKS_API_PASSWORD"];
}

export function configuredChannels(): Channel[] {
  if (!serverSecret()) return [];
  return [
    ...(emailConfigured() ? (["email"] as const) : []),
    ...(smsConfigured() ? (["sms"] as const) : []),
  ];
}

/** Svenskt mobilnummer i formatet +467XXXXXXXX, eller internationellt med +. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  let e164: string;
  if (trimmed.startsWith("+")) e164 = `+${digits}`;
  else if (digits.startsWith("00")) e164 = `+${digits.slice(2)}`;
  else if (digits.startsWith("0")) e164 = `+46${digits.slice(1)}`;
  else if (digits.startsWith("46")) e164 = `+${digits}`;
  else return null;
  if (e164.startsWith("+46")) return /^\+467\d{8}$/.test(e164) ? e164 : null;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type OutgoingMessage = {
  title: string;
  body: string | null;
  link: string | null;
  organizationName: string;
};

export function renderEmail(msg: OutgoingMessage, baseUrl = appUrl()) {
  const url = `${baseUrl}${msg.link ?? "/app"}`;
  const profileUrl = `${baseUrl}/app/profil`;
  const body = msg.body ?? "";
  const text = [
    msg.title,
    "",
    body,
    "",
    `Öppna: ${url}`,
    "",
    `Du får det här från ${msg.organizationName} via Boendeplattformen.`,
    `Välj vilka utskick du vill ha: ${profileUrl}`,
  ].join("\n");
  const html = `<!doctype html>
<html lang="sv"><body style="margin:0;background:#f4f1ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c2333">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#1e2a44;padding:20px 28px;color:#ffffff;font-size:15px;font-weight:600">
<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#f2b441;margin-right:8px"></span>${escapeHtml(msg.organizationName)}
</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapeHtml(msg.title)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3b4459">${escapeHtml(body).replace(/\n/g, "<br>")}</p>
<a href="${escapeHtml(url)}" style="display:inline-block;background:#1e2a44;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:10px;font-size:14px;font-weight:600">Öppna i Boendeplattformen</a>
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #ece7dc;font-size:12px;line-height:1.5;color:#7a8194">
Du får det här från ${escapeHtml(msg.organizationName)} via Boendeplattformen.
<a href="${escapeHtml(profileUrl)}" style="color:#7a8194">Välj vilka utskick du vill ha</a>.
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  return { subject: msg.title, html, text };
}

/** Högst två sms-delar (306 tecken) inklusive länken. */
export function renderSms(msg: OutgoingMessage, baseUrl = appUrl()) {
  const url = `${baseUrl}${msg.link ?? "/app"}`;
  const head = `${msg.organizationName}: ${msg.title}`;
  const room = 300 - url.length - 1;
  let text = msg.body ? `${head}. ${msg.body.replace(/\s+/g, " ").trim()}` : head;
  if (text.length > room) text = `${text.slice(0, room - 1).trimEnd()}…`;
  return `${text} ${url}`;
}

type Claimed = {
  id: string;
  channel: string;
  recipient: string;
  attempts: number;
  title: string;
  body: string | null;
  link: string | null;
  organization_name: string;
};

type Outcome = { ok: boolean; providerId?: string; error?: string; retry?: boolean };

async function sendEmails(rows: Claimed[]): Promise<Map<string, Outcome>> {
  const result = new Map<string, Outcome>();
  const valid = rows.filter((r) => {
    if (EMAIL_RE.test(r.recipient)) return true;
    result.set(r.id, { ok: false, error: "Ogiltig e-postadress", retry: false });
    return false;
  });
  const from = process.env["EMAIL_FROM"] ?? "Boendeplattformen <onboarding@resend.dev>";
  // Resend tar emot upp till 100 mejl per anrop.
  for (let i = 0; i < valid.length; i += 100) {
    const chunk = valid.slice(i, i + 100);
    const payload = chunk.map((r) => {
      const mail = renderEmail({
        title: r.title,
        body: r.body,
        link: r.link,
        organizationName: r.organization_name,
      });
      return { from, to: [r.recipient], ...mail };
    });
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env["RESEND_API_KEY"]}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { id: string }[];
        message?: string;
      } | null;
      if (!res.ok) {
        const error = `Resend ${res.status}: ${json?.message ?? res.statusText}`;
        const retry = res.status === 429 || res.status >= 500;
        for (const r of chunk) result.set(r.id, { ok: false, error, retry });
        continue;
      }
      chunk.forEach((r, idx) => {
        const providerId = json?.data?.[idx]?.id;
        result.set(r.id, providerId ? { ok: true, providerId } : { ok: true });
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : "Nätverksfel";
      for (const r of chunk) result.set(r.id, { ok: false, error, retry: true });
    }
  }
  return result;
}

async function sendOneSms(row: Claimed): Promise<Outcome> {
  const to = normalizePhone(row.recipient);
  if (!to) return { ok: false, error: "Ogiltigt mobilnummer", retry: false };
  const from = (process.env["SMS_FROM"] ?? "Boende").replace(/[^A-Za-z0-9]/g, "").slice(0, 11);
  const form = new URLSearchParams({
    from: from || "Boende",
    to,
    message: renderSms({
      title: row.title,
      body: row.body,
      link: row.link,
      organizationName: row.organization_name,
    }),
  });
  if (process.env["ELKS_DRYRUN"] === "true") form.set("dryrun", "yes");
  const auth = Buffer.from(
    `${process.env["ELKS_API_USERNAME"]}:${process.env["ELKS_API_PASSWORD"]}`,
  ).toString("base64");
  try {
    const res = await fetch("https://api.46elks.com/a1/sms", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        error: `46elks ${res.status}: ${text.slice(0, 200)}`,
        retry: res.status === 429 || res.status >= 500,
      };
    }
    const json = JSON.parse(text) as { id?: string };
    return json.id ? { ok: true, providerId: json.id } : { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Nätverksfel", retry: true };
  }
}

async function sendSms(rows: Claimed[]) {
  const result = new Map<string, Outcome>();
  const queue = [...rows];
  await Promise.all(
    Array.from({ length: Math.min(4, queue.length) }, async () => {
      for (let row = queue.shift(); row; row = queue.shift()) {
        result.set(row.id, await sendOneSms(row));
      }
    }),
  );
  return result;
}

/**
 * Skickar köade utskick. Körs direkt efter att notiser skapats och med
 * jämna mellanrum; flera samtidiga körningar tar aldrig samma utskick.
 */
export async function flushDeliveries(opts: { budgetMs?: number } = {}) {
  const channels = configuredChannels();
  const secret = serverSecret();
  const totals = { sent: 0, failed: 0 };
  if (channels.length === 0 || !secret) return totals;
  const db = serverDb();
  const deadline = Date.now() + (opts.budgetMs ?? 8000);
  while (Date.now() < deadline) {
    const { data, error } = await db.rpc("claim_notification_deliveries", {
      _secret: secret,
      _channels: channels,
      _limit: 100,
    });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Claimed[];
    if (rows.length === 0) break;
    const [emails, sms] = await Promise.all([
      sendEmails(rows.filter((r) => r.channel === "email")),
      sendSms(rows.filter((r) => r.channel === "sms")),
    ]);
    const outcomes = new Map([...emails, ...sms]);
    await Promise.all(
      rows.map(async (r) => {
        const o = outcomes.get(r.id) ?? { ok: false, error: "Okänd kanal", retry: false };
        if (o.ok) totals.sent++;
        else totals.failed++;
        const { error: finishError } = await db.rpc("finish_notification_delivery", {
          _secret: secret,
          _id: r.id,
          _ok: o.ok,
          _provider_id: o.providerId ?? null,
          _error: o.error ?? null,
          _retry: o.retry ?? true,
        });
        if (finishError) console.error(`Utskick ${r.id}: ${finishError.message}`);
      }),
    );
    if (rows.length < 100) break;
  }
  return totals;
}

/** Skickar kön efter en åtgärd; fel loggas men stoppar aldrig åtgärden. */
export async function deliverQueued(budgetMs = 8000) {
  try {
    await flushDeliveries({ budgetMs });
  } catch (e) {
    console.error(`Utskick: ${e instanceof Error ? e.message : String(e)}`);
  }
}

let lastOpportunisticRun = 0;

/**
 * Omförsök och sådant som köats utan att skickas direkt tas om hand när
 * appen ändå används, högst en gång i minuten per serverinstans.
 */
export async function deliverQueuedOccasionally() {
  if (configuredChannels().length === 0) return;
  if (Date.now() - lastOpportunisticRun < 60_000) return;
  lastOpportunisticRun = Date.now();
  await deliverQueued(3000);
}
