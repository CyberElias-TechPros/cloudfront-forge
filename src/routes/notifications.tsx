import { createFileRoute } from "@tanstack/react-router";
import { CheckCheck } from "lucide-react";
import { PageHeader, Shell } from "@/components/page-parts";
import {
  useNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — LoopSquad" },
      { name: "description", content: "Your LoopSquad activity feed." },
    ],
  }),
  component: Notifications,
});

function Notifications() {
  const { data: notifications = [], isLoading } = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();

  const unread = notifications.filter((n: any) => !n.is_read);

  return (
    <Shell>
      <PageHeader
        title="Notifications"
        description={`${unread.length} unread`}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending || unread.length === 0}
          >
            <CheckCheck className="size-4 mr-1" /> Mark all read
          </Button>
        }
      />

      <div className="mt-6 space-y-2">
        {isLoading && (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        )}
        {!isLoading && notifications.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No notifications yet. Watch a video or complete a mission to get started.
          </div>
        )}
        {notifications.map((n: any) => (
          <button
            key={n.id}
            type="button"
            onClick={() => {
              if (!n.is_read) markOne.mutate(n.id);
            }}
            className={cn(
              "w-full rounded-lg border p-4 text-left transition-colors",
              n.is_read
                ? "border-border bg-card opacity-70 hover:bg-secondary/40"
                : "border-accent/40 bg-accent/5 hover:bg-accent/10",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={cn("text-sm", n.is_read ? "font-normal" : "font-semibold")}>
                  {n.title}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
              </div>
              {!n.is_read && <span className="mt-1 size-2 shrink-0 rounded-full bg-accent" aria-label="unread" />}
            </div>
            {n.created_at && (
              <p className="mt-1 text-xs text-muted-foreground/70">{new Date(n.created_at).toLocaleString()}</p>
            )}
          </button>
        ))}
      </div>
    </Shell>
  );
}
