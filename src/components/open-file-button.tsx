import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { openFile } from "@/lib/files";
import { Button } from "@/components/ui/button";

/** Öppnar ett dokument i en ny flik, eller visar att filen saknas. */
export function OpenFileButton({ path }: { path: string | null | undefined }) {
  const [busy, setBusy] = useState(false);
  if (!path) return <span className="text-xs text-muted-foreground">Ingen fil</span>;
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await openFile(path);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Filen kunde inte öppnas");
        } finally {
          setBusy(false);
        }
      }}
    >
      <ExternalLink /> Öppna
    </Button>
  );
}
