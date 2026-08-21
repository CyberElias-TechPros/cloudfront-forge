import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  MessageCircle,
  Pause,
  Play,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Shell, Thumb } from "@/components/page-parts";
import { useQueueTasks, useWatch } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/queue")({
  head: () => ({
    meta: [
      { title: "Watch Queue — LoopSquad" },
      {
        name: "description",
        content:
          "Watch squad videos with verified watch time, then confirm your subscribe and comment to claim points.",
      },
      { property: "og:title", content: "Watch Queue — LoopSquad" },
      {
        property: "og:description",
        content: "Verified watch time, subscribe confirmation and comment proof in one flow.",
      },
    ],
  }),
  component: Queue,
});

const filters = ["All", "Pending", "In progress", "Verified", "Expired"] as const;

function Queue() {
  const { data: tasks = [], isLoading, isError, error } = useQueueTasks();
  const watch = useWatch();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = tasks.find((t) => t.id === activeId) ?? tasks[0];
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [commented, setCommented] = useState(false);
  const [claimedIds, setClaimedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");

  const alreadyClaimed = active
    ? claimedIds.includes(active.id) || active.status === "verified"
    : false;

  const handleClaim = async () => {
    if (!active) return;
    try {
      const result = (await watch.mutateAsync({
        videoId: active.id,
        watchSeconds: elapsed,
        subscribed,
        commented,
      })) as {
        status: string;
        claimable: boolean;
        xpAwarded: number;
        creditsAwarded: number;
        subReason?: string;
      };
      setClaimedIds((ids) => [...ids, active.id]);
      if (watch.isError) {
        toast.error("Watch claim failed. Please try again.");
      } else if (result.xpAwarded > 0 && result.creditsAwarded > 0) {
        toast.success(`Claimed +${active.reward} points! (${result.status})`);
      } else if (result.subReason) {
        toast.info(`Watch recorded: ${result.subReason}`);
      } else {
        toast.success(`Claimed +${active.reward} points!`);
      }
    } catch (error) {
      console.error("Watch claim error:", error);
      toast.error("Could not claim right now. Try again.");
    }
  };

  useEffect(() => {
    setElapsed(0);
    setPlaying(false);
    setSubscribed(false);
    setCommented(false);
  }, [activeId]);

  useEffect(() => {
    if (!playing || !active) return;
    const id = setInterval(() => {
      setElapsed((e) => Math.min(e + 1, active.requiredSec));
    }, 1000);
    return () => clearInterval(id);
  }, [playing, active]);

  const pct = Math.round((elapsed / (active?.requiredSec ?? 1)) * 100);
  const watchDone = elapsed >= (active?.requiredSec ?? 0);
  // Use the watch hook's status if available, otherwise compute from subs/comment/duration
  const hookStatus = (watch.status as string) ?? "started";
  const claimable = hookStatus === "claimed" || (watchDone && subscribed && commented);

  const shown = tasks.filter((t) =>
    filter === "All"
      ? true
      : filter === "Pending"
        ? t.status === "pending"
        : filter === "In progress"
          ? t.status === "watching"
          : filter === "Verified"
            ? t.status === "verified"
            : t.status === "expired",
  );

  if (!active) {
    if (isLoading) {
      return (
        <Shell>
          <PageHeader
            eyebrow="Fair rotation"
            title="Watch Queue"
            description="The timer only counts while the video is playing and in focus. Random attention checks keep it honest."
          />
          <div className="flex min-h-[50vh] items-center justify-center">
            <div className="text-center">
              <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Loading queue...</p>
            </div>
          </div>
        </Shell>
      );
    }
    if (isError) {
      return (
        <Shell>
          <PageHeader
            eyebrow="Fair rotation"
            title="Watch Queue"
            description="The timer only counts while the video is playing and in focus. Random attention checks keep it honest."
          />
          <div className="mt-6 surface p-6 text-center text-destructive">
            <p className="text-sm">Failed to load watch queue. Please try again later.</p>
            <p className="mt-1 text-xs text-muted-foreground">{(error as Error).message}</p>
          </div>
        </Shell>
      );
    }
    return (
      <Shell>
        <PageHeader
          eyebrow="Fair rotation"
          title="Watch Queue"
          description="The timer only counts while the video is playing and in focus. Random attention checks keep it honest."
        />
        <p className="mt-6 text-sm text-muted-foreground">
          No videos in the queue yet. Check back soon or post your own submission.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader
        eyebrow="Fair rotation"
        title="Watch Queue"
        description="The timer only counts while the video is playing and in focus. Random attention checks keep it honest."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="surface overflow-hidden">
          <Thumb hue={active.thumbHue} label={active.niche} />
          <div className="p-6">
            <h2 className="text-3xl">{active.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {active.owner} · {active.handle} · posted {active.postedAgo}
            </p>

            <div className="mt-5 rounded-lg bg-secondary/60 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Clock className="size-4 text-accent" /> Verified watch time
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {format(elapsed)} / {format(active.requiredSec)}
                </span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-background">
                <div
                  className={cn("h-full transition-all", watchDone ? "bg-success" : "bg-primary")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                disabled={watchDone}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {watchDone ? (
                  <>
                    <CheckCircle2 className="size-4" /> Watch verified
                  </>
                ) : playing ? (
                  <>
                    <Pause className="size-4" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="size-4" /> Start watching
                  </>
                )}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ProofButton
                icon={<UserPlus className="size-4" />}
                label="I subscribed"
                done={subscribed}
                disabled={!watchDone}
                onClick={() => setSubscribed(true)}
              />
              <ProofButton
                icon={<MessageCircle className="size-4" />}
                label="I left a comment"
                done={commented}
                disabled={!watchDone}
                onClick={() => setCommented(true)}
              />
            </div>

            <button
              type="button"
              onClick={handleClaim}
              disabled={!claimable || alreadyClaimed || watch.isPending}
              className="mt-4 w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40"
            >
              {alreadyClaimed
                ? "Claimed"
                : watch.isPending
                  ? "Claiming…"
                  : claimable
                    ? `Claim +${active.reward} points`
                    : `${hookStatus === "verified" ? "Watch verified" : hookStatus === "started" ? "Start watching" : "Claim unavailable"}`}
            </button>

            <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              Unsubscribing within 30 days reverses the points and lowers your trust score. Weekly
              sweeps check every claim.
            </p>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full border border-border px-3 py-1.5 text-xs",
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>

          <ul className="mt-4 space-y-3">
            {shown.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(t.id)}
                  className={cn(
                    "surface flex w-full gap-3 p-3 text-left transition-colors hover:bg-secondary/50",
                    t.id === activeId && "glow-ring",
                  )}
                >
                  <span className="w-28 shrink-0">
                    <Thumb hue={t.thumbHue} label={t.niche} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-medium">{t.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{t.handle}</span>
                    <span className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-widest">
                      <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                        {t.status}
                      </span>
                      <span className="text-accent">+{t.reward} pts</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}

function ProofButton({
  icon,
  label,
  done,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  done: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || done}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium disabled:opacity-50",
        done ? "border-success/50 bg-success/15 text-success" : "bg-card",
      )}
    >
      {done ? <CheckCircle2 className="size-4" /> : icon}
      {done ? "Confirmed" : label}
    </button>
  );
}

function format(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
