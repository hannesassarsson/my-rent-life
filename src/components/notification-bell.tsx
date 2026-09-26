import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";

import { getNotifications, markNotificationsRead } from "@/lib/app.functions";
import { dateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Klocka med olästa notiser. Hämtar om varje minut. */
export function NotificationBell({ className }: { className?: string }) {
  const fn = useServerFn(getNotifications);
  const markFn = useServerFn(markNotificationsRead);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
    // Notiserna är en bisak; ett fel här ska inte ta ner sidan.
    throwOnError: false,
  });

  const mark = useMutation({
    mutationFn: (ids?: string[]) => markFn({ data: ids ? { ids } : {} }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = data?.unread ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
          aria-label={unread > 0 ? `Notiser, ${unread} olästa` : "Notiser"}
        >
          <Bell className="size-5" />
          {unread > 0 ? (
            <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.625rem] leading-4 font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notiser</p>
          {unread > 0 ? (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => mark.mutate(undefined)}
            >
              Markera alla som lästa
            </button>
          ) : null}
        </div>
        {!data || data.items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Inga notiser</p>
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {data.items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={cn(
                    "w-full px-4 py-3 text-left transition hover:bg-surface-muted",
                    !n.is_read && "bg-accent/60",
                  )}
                  onClick={() => {
                    if (!n.is_read) mark.mutate([n.id]);
                    if (n.link) void navigate({ to: n.link });
                  }}
                >
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  ) : null}
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">
                    {dateTime(n.created_at)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
