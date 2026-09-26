import { supabase } from "@/integrations/supabase/client";

// Filer ligger i den privata bucketen "files" och nås via tidsbegränsade
// länkar. Behörigheten styrs av Storage-reglerna i migrationen files.

export const FILE_BUCKET = "files";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic"];
export const DOCUMENT_TYPES = [
  "application/pdf",
  ...IMAGE_TYPES,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

/** Filnamn utan konstiga tecken, med behållen filändelse. */
function safeName(name: string) {
  const cleaned = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  return cleaned || "fil";
}

export function checkFile(file: File, allowed: string[]) {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} är större än 10 MB`);
  if (!allowed.includes(file.type))
    throw new Error(`${file.name} har ett filformat som inte stöds`);
}

/** Laddar upp en fil under prefix och returnerar sökvägen i bucketen. */
export async function uploadFile(prefix: string, file: File) {
  const path = `${prefix}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await supabase.storage
    .from(FILE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Kunde inte ladda upp ${file.name}: ${error.message}`);
  return path;
}

/** Öppnar en fil i en ny flik via en länk som gäller i en minut. */
export async function openFile(path: string) {
  // Öppna fliken direkt så att popup-spärrar inte stoppar den.
  const tab = window.open("", "_blank");
  const { data, error } = await supabase.storage.from(FILE_BUCKET).createSignedUrl(path, 60);
  if (error || !data) {
    tab?.close();
    throw new Error("Filen kunde inte öppnas");
  }
  if (tab) tab.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}

/** Tidsbegränsade länkar för flera filer, t.ex. bilder i ett ärende. */
export async function signedUrls(paths: string[], seconds = 3600) {
  if (paths.length === 0) return {} as Record<string, string>;
  const { data } = await supabase.storage.from(FILE_BUCKET).createSignedUrls(paths, seconds);
  return Object.fromEntries(
    (data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl]),
  );
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function fileKindOf(file: File) {
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("image/")) return file.type.split("/")[1] ?? "bild";
  if (file.type.includes("wordprocessingml")) return "docx";
  if (file.type.includes("spreadsheetml")) return "xlsx";
  return "fil";
}

/** Laddar upp bilder till ett ärende och registrerar dem. */
export async function attachImages(
  add: (args: {
    data: {
      requestId: string;
      files: { storagePath: string; fileName: string; contentType: string; sizeBytes: number }[];
    };
  }) => Promise<unknown>,
  request: { id: string; organization_id: string },
  files: File[],
) {
  files.forEach((f) => checkFile(f, IMAGE_TYPES));
  const uploaded = [];
  for (const file of files) {
    const storagePath = await uploadFile(`${request.organization_id}/requests/${request.id}`, file);
    uploaded.push({
      storagePath,
      fileName: file.name.slice(0, 200),
      contentType: file.type,
      sizeBytes: file.size,
    });
  }
  await add({ data: { requestId: request.id, files: uploaded } });
}
