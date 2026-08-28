import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Coins, Eye, MessageCircle, Rocket, UserPlus, Video, Zap } from "lucide-react";
import { PageHeader, Shell, StatCard } from "@/components/page-parts";
import { AdSlot } from "@/components/ad-slot";
import { useCreatorInsights } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights — LoopSquad" },
      {
        name: "description",
        content:
          "See how your videos perform across the community: watches, subscribes, comments and watch time received.",
      },
      { property: "og:title", content: "Insights — LoopSquad" },
      {
        property: "og:description",
        content: "Creator analytics: track your videos' watch time, subscribes and comments.",
      },
    ],
  }),
  component: Insights,
});

function formatMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function Insights() {
  const { data, isLoading, isError } = useCreatorInsights();

  if (isLoading) {
    return (
      <Shell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading your insights...</p>
          </div>
        </div>
      </Shell>
    );
  }

  if (isError || !data) {
    return (
      <Shell>
        <PageHeader eyebrow="Creator tools" title="Insights" description="" />
        <div className="mt-6 surface p-6 text-center text-destructive">
          <p className="text-sm">Failed to load insights. Please try again later.</p>
        </div>
      </Shell>
    );
  }

  const { totals, videos, earnings } = data;

  return (
    <Shell>
      <PageHeader
        eyebrow={`Creator tools · Level ${earnings.level}`}
        title="Insights"
        description="How your videos are performing across the community — watch time, subscribes and comments received."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Videos submitted"
          value={totals.videos.toLocaleString()}
          hint="All-time"
          icon={<Video className="size-4" />}
        />
        <StatCard
          label="Watches received"
          value={totals.watchesReceived.toLocaleString()}
          hint="Sessions on your videos"
          icon={<Eye className="size-4" />}
        />
        <StatCard
          label="Subscribes received"
          value={totals.subsReceived.toLocaleString()}
          hint="Confirmed by members"
          icon={<UserPlus className="size-4" />}
        />
        <StatCard
          label="Comments received"
          value={totals.commentsReceived.toLocaleString()}
          hint="Genuine feedback"
          icon={<MessageCircle className="size-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Watch time received"
          value={formatMinutes(totals.watchMinutesReceived * 60)}
          hint={`${totals.watchMinutesReceived} minutes total`}
          icon={<BarChart3 className="size-4" />}
        />
        <StatCard
          label="XP"
          value={earnings.xp.toLocaleString()}
          hint={`Level ${earnings.level}`}
          icon={<Zap className="size-4" />}
        />
        <StatCard
          label="Credits"
          value={earnings.credits.toLocaleString()}
          hint="Spendable balance"
          icon={<Coins className="size-4" />}
        />
        <StatCard
          label="Reviews given"
          value={earnings.reviewsGiven.toLocaleString()}
          hint="Feedback you provided"
          icon={<Rocket className="size-4" />}
        />
      </div>

      <section className="surface mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-xl">Your videos</h2>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {videos.length} total
          </span>
        </div>

        {videos.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No videos yet — submit your first video to start tracking performance.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {videos.map((v) => {
              const progress =
                v.watchTarget > 0 ? Math.min(100, (v.watches / v.watchTarget) * 100) : 0;
              return (
                <li key={v.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{v.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(v.postedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {v.boosted && (
                        <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-accent">
                          Boosted
                        </span>
                      )}
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                        {v.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="size-3.5" /> {v.watches} watches
                    </span>
                    <span className="flex items-center gap-1">
                      <UserPlus className="size-3.5" /> {v.subs} subs
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="size-3.5" /> {v.comments} comments
                    </span>
                    <span className="flex items-center gap-1">
                      <BarChart3 className="size-3.5" /> {formatMinutes(v.watchSeconds)}
                    </span>
                  </div>

                  {v.watchTarget > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Watch target progress</span>
                        <span>
                          {v.watches}/{v.watchTarget}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={cn("h-full", progress >= 100 ? "bg-success" : "bg-primary")}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AdSlot className="mt-6" />
    </Shell>
  );
}
