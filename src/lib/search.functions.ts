// Sökning för boende: "Vad letar du efter?" Söker i det den inloggade får
// se (radreglerna gäller) och föreslår vad man kan göra.

import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { docTypeLabels } from "@/lib/format";

type Db = SupabaseClient<Database>;

export type SearchHit = {
  kind: "action" | "resource" | "document" | "news" | "request" | "meeting";
  title: string;
  detail?: string;
  to: string;
  search?: Record<string, string>;
  params?: Record<string, string>;
};

/** Genvägar som hittas via vanliga ord, även när inget innehåll matchar. */
const ACTIONS: { title: string; to: string; words: string[] }[] = [
  {
    title: "Gör en felanmälan",
    to: "/app/felanmalan",
    words: [
      "fel",
      "trasig",
      "läck",
      "vatten",
      "el",
      "ström",
      "värme",
      "kallt",
      "lås",
      "dörr",
      "avlopp",
      "stopp",
      "felanmälan",
      "reparation",
      "laga",
    ],
  },
  {
    title: "Boka tvättstuga eller lokal",
    to: "/app/bokningar",
    words: ["boka", "tvätt", "bastu", "lokal", "gästrum", "fest", "laddplats", "bokning"],
  },
  {
    title: "Skriv till föreningen",
    to: "/app/meddelanden",
    words: ["fråga", "skriv", "meddelande", "kontakt", "styrelse", "förvalt", "hyresvärd"],
  },
  {
    title: "Mitt boende",
    to: "/app/boende",
    words: ["lägenhet", "boende", "förråd", "parkering", "nyckel", "sambo", "hushåll", "adress"],
  },
  {
    title: "Min avgift eller hyra",
    to: "/app/ekonomi",
    words: ["avgift", "hyra", "betal", "faktura", "avi", "pengar", "bankgiro", "ocr"],
  },
  {
    title: "Föreningspärmen – dokument",
    to: "/app/dokument",
    words: [
      "dokument",
      "stadgar",
      "regler",
      "trivsel",
      "ordning",
      "protokoll",
      "årsredovisning",
      "försäkring",
      "andrahand",
      "uthyrning",
      "brand",
    ],
  },
  {
    title: "Nyheter från föreningen",
    to: "/app/information",
    words: ["nyhet", "information", "avstängning", "städdag", "arbete", "renovering"],
  },
  { title: "Möten och stämma", to: "/app/moten", words: ["möte", "stämma", "årsmöte", "motion"] },
  {
    title: "Ändra mina kontaktuppgifter",
    to: "/app/profil",
    words: [
      "profil",
      "namn",
      "telefon",
      "e-post",
      "mejl",
      "lösenord",
      "bankid",
      "notis",
      "avisering",
    ],
  },
  {
    title: "Kontakta föreningen och jour",
    to: "/app/sok",
    words: ["jour", "akut", "hjälp", "kontakt", "telefon", "nummer"],
  },
];

/** Tar bort tecken som har betydelse i sökfrågor mot databasen. */
function clean(q: string) {
  return q
    .replace(/[%_,()\\*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const searchEverything = createServerFn({ method: "GET" })
  .inputValidator(z.object({ q: z.string().max(100) }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const q = clean(data.q);
    if (q.length < 2) return [] as SearchHit[];
    const needle = q.toLowerCase();
    const like = `%${q}%`;

    const typeMatches = Object.entries(docTypeLabels)
      .filter(([, label]) => label.toLowerCase().includes(needle))
      .map(([type]) => type);

    const [resources, documents, byType, news, requests, meetings] = await Promise.all([
      supabase
        .from("resources")
        .select("id, name, location")
        .eq("is_active", true)
        .ilike("name", like)
        .limit(5),
      supabase.from("documents").select("id, title, doc_type").ilike("title", like).limit(8),
      typeMatches.length
        ? supabase
            .from("documents")
            .select("id, title, doc_type")
            .in("doc_type", typeMatches)
            .limit(8)
        : Promise.resolve({ data: [] as { id: string; title: string; doc_type: string }[] }),
      supabase
        .from("announcements")
        .select("id, title, published_at")
        .eq("is_published", true)
        .or(`title.ilike.${like},body.ilike.${like}`)
        .order("published_at", { ascending: false })
        .limit(5),
      supabase
        .from("maintenance_requests")
        .select("id, title, ticket_number")
        .eq("reported_by", context.userId)
        .ilike("title", like)
        .limit(5),
      supabase
        .from("meetings")
        .select("id, title, starts_at")
        .ilike("title", like)
        .order("starts_at", { ascending: false })
        .limit(3),
    ]);

    const hits: SearchHit[] = [];
    for (const a of ACTIONS) {
      const words = needle.split(" ");
      const matches = a.words.some((w) =>
        // Korta ord (t.ex. "el") måste stå för sig själva för att inte träffa "telefon".
        w.length < 3 ? words.includes(w) : needle.includes(w) || w.startsWith(needle),
      );
      if (a.title.toLowerCase().includes(needle) || matches) {
        hits.push({ kind: "action", title: a.title, to: a.to });
      }
    }
    for (const r of resources.data ?? []) {
      hits.push({
        kind: "resource",
        title: `Boka ${r.name}`,
        ...(r.location ? { detail: r.location } : {}),
        to: "/app/bokningar",
        search: { resurs: r.id },
      });
    }
    const seenDocs = new Set<string>();
    for (const d of [...(documents.data ?? []), ...(byType.data ?? [])]) {
      if (seenDocs.has(d.id)) continue;
      seenDocs.add(d.id);
      hits.push({
        kind: "document",
        title: d.title,
        detail: docTypeLabels[d.doc_type] ?? "Dokument",
        to: "/app/dokument",
        search: { q: d.title },
      });
    }
    for (const n of news.data ?? []) {
      hits.push({ kind: "news", title: n.title, detail: "Nyhet", to: "/app/information" });
    }
    for (const r of requests.data ?? []) {
      hits.push({
        kind: "request",
        title: r.title,
        detail: `Din felanmälan #${r.ticket_number}`,
        to: "/app/felanmalan/$id",
        params: { id: r.id },
      });
    }
    for (const m of meetings.data ?? []) {
      hits.push({ kind: "meeting", title: m.title, detail: "Möte", to: "/app/moten" });
    }
    return hits.slice(0, 30);
  });
