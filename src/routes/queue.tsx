import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  Flag,
  MessageCircle,
  Pause,
  Play,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Shell, Thumb } from "@/components/page-parts";
import { AdSlot } from "@/components/ad-slot";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueueTasks, useWatch, useCreateReport, useAttentionChallenge, useAnswerChallenge } from "@/hooks/use-api";
import { apiClientService } from "@/lib/api-client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

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
  const report = useCreateReport();
  const getChallenge = useAttentionChallenge();
  const answerChallenge = useAnswerChallenge();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = tasks.find((t) => t.id === activeId) ?? tasks[0];
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [commented, setCommented] = useState(false);
  const [claimedIds, setClaimedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [subOpened, setSubOpened] = useState(false);
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const lastSampleRef = useRef<number | null>(null);
  const playerStateRef = useRef<number>(-1);
  const [ytReady, setYtReady] = useState(false);
  const challengeThresholdRef = useRef<number | null>(null);
  const challengeFiredRef = useRef(false);
  const [activeChallenge, setActiveChallenge] = useState<{ id: string; question: string } | null>(null);
  const [challengeAnswer, setChallengeAnswer] = useState("");
  const [attentionVoided, setAttentionVoided] = useState(false);
  const sessionTokenRef = useRef<string | null>(null);

  const alreadyClaimed = active
    ? claimedIds.includes(active.id) || active.status === "verified"
    : false;

  const handleClaim = async () => {
    if (!active) return;
    try {
      const result = (await watch.mutateAsync({
        videoId: active.id,
        watchSeconds: Math.round(elapsed),
        subscribed,
        commented,
        ...(sessionTokenRef.current ? { sessionToken: sessionTokenRef.current } : {}),
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
    setSubOpened(false);
    lastSampleRef.current = null;
    // New video: schedule a mid-watch attention check at a random 40-70% point
    challengeThresholdRef.current = active ? (0.4 + Math.random() * 0.3) * active.requiredSec : null;
    challengeFiredRef.current = false;
    setActiveChallenge(null);
    setAttentionVoided(false);
    setChallengeAnswer("");
    sessionTokenRef.current = null;
  }, [activeId]);

  // Watch time is sampled from the YouTube player's own clock so the platform
  // timer matches real playback: buffering doesn't count, seeking doesn't credit,
  // and playback rate >1.25x or muted playback halves the credit.
  useEffect(() => {
    if (!playing || !active) return;
    lastSampleRef.current = null;
    const tick = () => {
      if (document.hidden) return;
      const p = playerRef.current;
      if (p?.getCurrentTime) {
        if (playerStateRef.current !== 1) return; // only credit while actually PLAYING
        let cur = 0;
        try { cur = p.getCurrentTime() ?? 0; } catch { return; }
        const last = lastSampleRef.current;
        if (last != null) {
          const delta = cur - last;
          // normal progression only: ignores seek jumps (forward or backward)
          if (delta > 0.1 && delta <= 2) {
            // Playback-rate guard: >1.25x stops crediting entirely
            let rate = 1;
            try { rate = p.getPlaybackRate?.() ?? 1; } catch { /* ignore */ }
            if (rate > 1.25) return;
            // Muted playback: credits at half speed
            let muted = false;
            try { muted = !!p.isMuted?.(); } catch { /* ignore */ }
            const factor = muted ? 0.5 : 1;
            setElapsed((e) => Math.min(e + delta * factor, active.requiredSec));
          }
        }
        lastSampleRef.current = cur;
      } else {
        // YT IFrame API unavailable (fallback iframe): degrade to wall-clock ticking
        setElapsed((e) => Math.min(e + 0.5, active.requiredSec));
      }
    };
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [playing, active]);

  // Mid-watch attention check: fires once when playback crosses the random threshold
  useEffect(() => {
    if (!active || attentionVoided) return;
    const threshold = challengeThresholdRef.current;
    if (threshold == null || challengeFiredRef.current) return;
    if (elapsed >= threshold && elapsed < active.requiredSec) {
      challengeFiredRef.current = true;
      getChallenge.mutate(
        active.id,
        {
          onSuccess: (res) => setActiveChallenge({ id: res.challengeId, question: res.question }),
          onError: () => {
            // Soft-fail: don't block the user on a challenge fetch error
            challengeFiredRef.current = false;
          },
        },
      );
    }
  }, [elapsed, active, attentionVoided]);

  // Signed watch session: request a token on first play, then send heartbeats every 30s
  useEffect(() => {
    if (!playing || !active) return;
    let cancelled = false;
    const loopId = setInterval(async () => {
      if (cancelled) return;
      if (!sessionTokenRef.current) {
        try {
          const res = await apiClientService.watch.start(active.id);
          if (!cancelled && res.enabled && res.sessionToken) {
            sessionTokenRef.current = res.sessionToken;
          }
        } catch {
          /* soft-fail */
        }
      }
      if (sessionTokenRef.current && !cancelled) {
        const p = playerRef.current;
        let pt = 0;
        try { pt = p?.getCurrentTime?.() ?? 0; } catch { /* ignore */ }
        apiClientService.watch.heartbeat(sessionTokenRef.current, pt).catch(() => {});
      }
    }, 30_000);
    return () => { cancelled = true; clearInterval(loopId); };
  }, [playing, active]);

  useEffect(() => {
    const onVis = () => { if (document.hidden) setPlaying(false); };
    const onBlur = () => setPlaying(false);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT?.Player) {
      setYtReady(true);
      return;
    }
    if (document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const check = setInterval(() => {
        if (window.YT?.Player) {
          setYtReady(true);
          clearInterval(check);
        }
      }, 300);
      return () => clearInterval(check);
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) try { prev(); } catch {}
      setYtReady(true);
    };
    const fallback = setTimeout(() => {
      if (window.YT?.Player) setYtReady(true);
    }, 3000);
    return () => clearTimeout(fallback);
  }, []);

  // Create YT player when video changes
  useEffect(() => {
    if (!active?.youtubeVideoId || !ytReady || !playerContainerRef.current) return;
    if (playerRef.current?.destroy) {
      try { playerRef.current.destroy(); } catch {}
      playerRef.current = null;
    }
    try {
      playerRef.current = new window.YT.Player(playerContainerRef.current, {
        videoId: active.youtubeVideoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, origin: window.location.origin },
        events: {
          onStateChange: (e: any) => {
            playerStateRef.current = e.data;
            if (e.data === 1) setPlaying(true);
            else if (e.data === 2 || e.data === 0) setPlaying(false);
          },
        },
      });
    } catch {}
    return () => {
      if (playerRef.current?.destroy) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
    };
  }, [active?.youtubeVideoId, ytReady]);

  // Sync playing to player
  useEffect(() => {
    const p = playerRef.current;
    if (!p?.playVideo || !p?.pauseVideo) return;
    try {
      if (playing) p.playVideo();
      else p.pauseVideo();
    } catch {}
  }, [playing]);

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
          {active.youtubeVideoId ? (
            <div className="relative aspect-video w-full overflow-hidden bg-black">
              <div ref={playerContainerRef} className="h-full w-full" />
              {!ytReady && (
                <iframe
                  key={active.youtubeVideoId}
                  src={`https://www.youtube.com/embed/${active.youtubeVideoId}?rel=0&modestbranding=1&enablejsapi=1&origin=${typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : ""}`}
                  title={active.title}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              )}
            </div>
          ) : (
            <Thumb hue={active.thumbHue} label={active.niche} />
          )}
          <div className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl">{active.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {active.owner} · {active.handle} · posted {active.postedAgo}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="grid size-8 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:bg-secondary"
                    title="Report this video"
                  >
                    <Flag className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(["spam", "inappropriate", "cheating", "misleading"] as const).map((reason) => (
                    <DropdownMenuItem
                      key={reason}
                      onClick={() => {
                        report.mutate(
                          {
                            resourceType: "video",
                            resourceId: active.id,
                            reason,
                            ...(active.creatorId ? { reportedUserId: active.creatorId } : {}),
                          },
                          {
                            onSuccess: () =>
                              toast.success(`Reported as ${reason}. Our team will review it.`),
                            onError: (e: Error) => toast.error(e.message || "Report failed"),
                          },
                        );
                      }}
                      className="capitalize"
                    >
                      Report as {reason}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {active.magicWord && (
              <div className="mt-3 rounded-lg border border-dashed border-accent/50 bg-accent/10 px-4 py-2.5">
                <p className="text-xs font-medium text-accent">
                  Comment hint — include this word in your comment: <span className="font-bold text-foreground">{active.magicWord}</span>
                </p>
              </div>
            )}

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
                label={subOpened ? "I subscribed" : "Click here to subscribe"}
                done={subscribed}
                disabled={!watchDone}
                onClick={() => {
                  const url = active.creatorChannelId
                    ? `https://www.youtube.com/channel/${active.creatorChannelId}?sub_confirmation=1`
                    : active.youtubeUrl || (active.youtubeVideoId ? `https://www.youtube.com/watch?v=${active.youtubeVideoId}` : "");
                  if (!url) return;
                  window.open(url, "_blank", "noopener");
                  if (!subOpened) {
                    setSubOpened(true);
                    toast.info("Channel opened — tap Subscribe on YouTube, then confirm here");
                  } else {
                    setSubscribed(true);
                    toast.success("Marked subscribed — points only award after server-side verification via the YouTube API");
                  }
                }}
              />
              <ProofButton
                icon={<MessageCircle className="size-4" />}
                label="I left a comment"
                done={commented}
                disabled={!watchDone}
                onClick={() => {
                  const url = active.youtubeUrl || (active.youtubeVideoId ? `https://www.youtube.com/watch?v=${active.youtubeVideoId}` : "");
                  if (url) window.open(url, "_blank", "noopener");
                  setCommented(true);
                  toast.success("Opened video — leave a genuine comment on YouTube, then return to claim");
                }}
              />
            </div>

            <button
              type="button"
              onClick={handleClaim}
              disabled={!claimable || alreadyClaimed || watch.isPending || attentionVoided}
              className="mt-4 w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-40"
            >
              {attentionVoided
                ? "Attention check failed — session voided"
                : alreadyClaimed
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
          <AdSlot className="mt-6" />
        </section>
      </div>

      <Dialog open={!!activeChallenge && !attentionVoided} onOpenChange={(open) => { if (!open) setActiveChallenge(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Quick attention check</DialogTitle>
            <DialogDescription>
              Answer to confirm you're actively watching. You get 2 attempts.
            </DialogDescription>
          </DialogHeader>
          {activeChallenge && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!challengeAnswer.trim()) return;
                answerChallenge.mutate(
                  { challengeId: activeChallenge.id, answer: challengeAnswer },
                  {
                    onSuccess: (res) => {
                      if (res.passed) {
                        toast.success("Verified — enjoy the rest of the video");
                        setActiveChallenge(null);
                        setChallengeAnswer("");
                      } else if (res.voided) {
                        setAttentionVoided(true);
                        setActiveChallenge(null);
                        toast.error("Attention check failed twice — this session is voided.");
                      } else {
                        toast.error("Wrong answer — one attempt left. Try again:");
                        getChallenge.mutate(active!.id, {
                          onSuccess: (r2) => setActiveChallenge({ id: r2.challengeId, question: r2.question }),
                        });
                        setChallengeAnswer("");
                      }
                    },
                    onError: (e: Error) => toast.error(e.message || "Could not submit answer"),
                  },
                );
              }}
              className="space-y-3"
            >
              <p className="text-center text-lg font-semibold">{activeChallenge.question}</p>
              <Input
                autoFocus
                inputMode="numeric"
                value={challengeAnswer}
                onChange={(e) => setChallengeAnswer(e.target.value)}
                placeholder="Your answer"
              />
              <button
                type="submit"
                disabled={answerChallenge.isPending || !challengeAnswer.trim()}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                {answerChallenge.isPending ? "Checking…" : "Submit"}
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
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
  const t = Math.floor(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}
