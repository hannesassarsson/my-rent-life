import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";

import { addRequestAttachments } from "@/lib/app.functions";
import { IMAGE_TYPES, attachImages, signedUrls } from "@/lib/files";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";

type Attachment = { id: string; storage_path: string; file_name: string };

export function RequestAttachments({
  request,
  attachments,
  canUpload = true,
}: {
  request: { id: string; organization_id: string };
  attachments: Attachment[];
  canUpload?: boolean;
}) {
  const addFn = useServerFn(addRequestAttachments);
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const paths = attachments.map((a) => a.storage_path);
  const { data: urls } = useQuery({
    queryKey: ["attachment-urls", ...paths],
    queryFn: () => signedUrls(paths),
    enabled: paths.length > 0,
    staleTime: 30 * 60_000,
  });

  async function onFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    setBusy(true);
    try {
      await attachImages(addFn, request, files);
      toast.success(files.length === 1 ? "Bilden är bifogad" : "Bilderna är bifogade");
      await qc.invalidateQueries({ queryKey: ["request", request.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte ladda upp");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  if (attachments.length === 0 && !canUpload) return null;

  return (
    <Panel
      title="Bilder"
      {...(attachments.length === 0 ? { description: "Inga bilder bifogade" } : {})}
      action={
        canUpload ? (
          <>
            <input
              ref={input}
              type="file"
              accept={IMAGE_TYPES.join(",")}
              multiple
              className="hidden"
              onChange={(e) => void onFiles(e.target.files)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <ImagePlus /> {busy ? "Laddar upp…" : "Lägg till bild"}
            </Button>
          </>
        ) : null
      }
    >
      {attachments.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {attachments.map((a) => {
            const url = urls?.[a.storage_path];
            return (
              <li key={a.id}>
                <button
                  type="button"
                  className="block aspect-square w-full overflow-hidden rounded-lg border border-border bg-surface-muted"
                  onClick={() => url && setPreview(url)}
                  title={a.file_name}
                >
                  {url ? (
                    <img src={url} alt={a.file_name} className="size-full object-cover" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {preview ? (
        <button
          type="button"
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6"
          onClick={() => setPreview(null)}
          aria-label="Stäng bilden"
        >
          <img src={preview} alt="" className="max-h-full max-w-full rounded-lg" />
        </button>
      ) : null}
    </Panel>
  );
}
