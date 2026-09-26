import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { addRequestAttachments, createRequest, getMyRequests } from "@/lib/app.functions";
import { IMAGE_TYPES, attachImages, checkFile } from "@/lib/files";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "@/components/ui-kit";
import { PriorityBadge, RequestStatusBadge } from "@/components/status-badge";
import { categoryLabels, dateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/felanmalan/")({
  head: () => ({
    meta: [
      { title: "Felanmälan – Boendeplattformen" },
      {
        name: "description",
        content: "Anmäl fel i din bostad och följ ärendet steg för steg.",
      },
      { property: "og:title", content: "Felanmälan – Boendeplattformen" },
      { property: "og:description", content: "Anmäl fel och följ dina ärenden." },
    ],
  }),
  component: MyRequests,
});

const rooms = ["Kök", "Badrum", "Vardagsrum", "Sovrum", "Hall", "Balkong", "Förråd", "Övrigt"];

function MyRequests() {
  const fn = useServerFn(getMyRequests);
  const create = useServerFn(createRequest);
  const attach = useServerFn(addRequestAttachments);
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["my-requests"], queryFn: () => fn() });

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [room, setRoom] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [images, setImages] = useState<File[]>([]);

  function reset() {
    setStep(1);
    setCategory("");
    setTitle("");
    setDescription("");
    setRoom("");
    setIsUrgent(false);
    setImages([]);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const created = await create({ data: { category, title, description, room, isUrgent } });
      if (images.length > 0) {
        try {
          await attachImages(attach, created, images);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Bilderna kunde inte laddas upp");
        }
      }
      return created;
    },
    onSuccess: (created) => {
      toast.success(`Felanmälan skickad – ärende #${created.ticket_number}`);
      void qc.invalidateQueries({ queryKey: ["my-requests"] });
      void qc.invalidateQueries({ queryKey: ["resident-dashboard"] });
      setOpen(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Felanmälan"
        subtitle="Anmäl fel i din bostad eller i gemensamma utrymmen"
        action={
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) reset();
            }}
          >
            <DialogTrigger asChild>
              <Button>Ny felanmälan</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Ny felanmälan</DialogTitle>
                <DialogDescription>Steg {step} av 3</DialogDescription>
              </DialogHeader>

              {step === 1 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {categoryLabels.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => {
                        setCategory(c.value);
                        setStep(2);
                      }}
                      className={cn(
                        "rounded-xl border border-border p-4 text-center transition hover:border-primary hover:bg-accent",
                        category === c.value && "border-primary bg-accent",
                      )}
                    >
                      <span className="text-xl">{c.icon}</span>
                      <span className="mt-1.5 block text-xs font-medium">{c.value}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Vad gäller det?</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="T.ex. Droppande kran i köket"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Beskriv felet</Label>
                    <Textarea
                      id="description"
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="När började det? Hur ofta händer det?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Var i bostaden?</Label>
                    <div className="flex flex-wrap gap-2">
                      {rooms.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRoom(r)}
                          className={cn(
                            "rounded-full border border-border px-3 py-1.5 text-xs font-medium transition hover:border-primary",
                            room === r && "border-primary bg-accent",
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="images">Bilder (valfritt)</Label>
                    <Input
                      id="images"
                      type="file"
                      accept={IMAGE_TYPES.join(",")}
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        try {
                          files.forEach((f) => checkFile(f, IMAGE_TYPES));
                          setImages(files.slice(0, 5));
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Ogiltig fil");
                          e.target.value = "";
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Högst 5 bilder, 10 MB per bild. En bild säger ofta mer än en beskrivning.
                    </p>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border p-4 text-sm">
                    <p className="font-medium">
                      {categoryLabels.find((c) => c.value === category)?.icon}{" "}
                      {title || "(ingen titel)"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {category}
                      {room ? ` · ${room}` : ""}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                    {images.length > 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {images.length} {images.length === 1 ? "bild" : "bilder"} bifogas
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border p-4">
                    <div>
                      <p className="text-sm font-medium">Akut ärende</p>
                      <p className="text-xs text-muted-foreground">
                        Vattenläckage, ingen värme eller något som riskerar skada.
                      </p>
                    </div>
                    <Switch checked={isUrgent} onCheckedChange={setIsUrgent} />
                  </div>
                </div>
              ) : null}

              <DialogFooter className="gap-2">
                {step > 1 ? (
                  <Button variant="outline" onClick={() => setStep(step - 1)}>
                    Tillbaka
                  </Button>
                ) : null}
                {step === 2 ? (
                  <Button disabled={!title.trim()} onClick={() => setStep(3)}>
                    Fortsätt
                  </Button>
                ) : null}
                {step === 3 ? (
                  <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                    {mutation.isPending ? "Skickar…" : "Skicka felanmälan"}
                  </Button>
                ) : null}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Panel title="Mina ärenden">
        {isPending ? (
          <LoadingBlock />
        ) : !data || data.length === 0 ? (
          <EmptyState title="Inga felanmälningar" description="Allt lugnt i din bostad." />
        ) : (
          <ul className="space-y-3">
            {data.map((r) => (
              <li key={r.id}>
                <Link
                  to="/app/felanmalan/$id"
                  params={{ id: r.id }}
                  className="block rounded-xl border border-border p-4 transition hover:border-primary"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{r.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ärende #{r.ticket_number} · {r.category}
                        {r.room ? ` · ${r.room}` : ""} · uppdaterad {dateTime(r.updated_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={r.priority} />
                      <RequestStatusBadge status={r.status} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
