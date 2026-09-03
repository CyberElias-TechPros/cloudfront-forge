import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, Flame, Lock, Settings2, Youtube } from "lucide-react";
import { useState, useEffect } from "react";
import { PageHeader, Shell, StatCard } from "@/components/page-parts";
import {
  useMyProfile,
  useXp,
  useCredits,
  useStreaks,
  useBadges,
  useCurrentMember,
  useActivity,
  useYouTubeStatus,
  useConnectYouTube,
  useDisconnectYouTube,
} from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile — LoopSquad" },
      {
        name: "description",
        content:
          "Track your level, trust score, badges, channel details and participation history in the squad.",
      },
      { property: "og:title", content: "Your Profile — LoopSquad" },
      {
        property: "og:description",
        content: "Level, trust score, badges and your full participation history.",
      },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { data: profile, isLoading: profileLoading, isError: profileError } = useMyProfile();
  const { data: xp, isLoading: xpLoading, isError: xpError } = useXp();
  const { data: credits, isLoading: creditsLoading, isError: creditsError } = useCredits();
  const { data: streaks, isLoading: streaksLoading, isError: streaksError } = useStreaks();
  const { data: badges = [], isLoading: badgesLoading, isError: badgesError } = useBadges();
  const { data: member, isLoading: memberLoading, isError: memberError } = useCurrentMember();
  const { data: activity = [], isLoading: activityLoading, isError: activityError } = useActivity();
  const { data: youtubeStatus, isLoading: ytLoading, isError: ytError } = useYouTubeStatus();
  const connectYouTube = useConnectYouTube();
  const disconnectYouTube = useDisconnectYouTube();

  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  useEffect(() => {
    if (connectYouTube.isSuccess) {
      toast.success("Opening YouTube authorization...");
    }
  }, [connectYouTube.isSuccess]);

  useEffect(() => {
    if (disconnectYouTube.isSuccess) {
      toast.success("YouTube account disconnected");
      setShowDisconnectDialog(false);
    }
  }, [disconnectYouTube.isSuccess]);

  const currentUser = member ?? {
    id: "",
    name: "Creator",
    handle: "@creator",
    avatar: "C",
    points: 0,
    streak: 0,
    level: 1,
    rank: 0,
    niche: "Creator",
    subsGiven: 0,
    subsReceived: 1,
    watchMinutes: 0,
    trustScore: 0,
  };

  const currentXP = xp?.totalXp ?? 0;
  const xpToNextLevel = xp?.xpToNextLevel ?? 250;
  const xpProgress = xp ? Math.max(0, Math.min(xpToNextLevel, currentXP)) : 0;
  const xpPct = xp ? Math.round((xpProgress / Math.max(xpToNextLevel, 1)) * 100) : null;
  const level = xp?.currentLevel ?? currentUser.level;
  const balance = credits?.balance ?? 0;
  const streak = streaks?.currentStreak ?? currentUser.streak;
  const displayName = profile?.displayName ?? currentUser.name;
  const photoUrl = profile?.photoUrl ?? null;
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : null;
  const loading =
    profileLoading ||
    xpLoading ||
    creditsLoading ||
    streaksLoading ||
    badgesLoading ||
    memberLoading ||
    activityLoading ||
    ytLoading;

  if (loading) {
    return (
      <Shell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading your profile...</p>
          </div>
        </div>
      </Shell>
    );
  }

  const error =
    profileError ||
    xpError ||
    creditsError ||
    streaksError ||
    badgesError ||
    memberError ||
    activityError ||
    ytError;
  if (error) {
    return (
      <Shell>
        <PageHeader eyebrow="" title="Your profile" description="" />
        <div className="mt-6 surface p-6 text-center text-destructive">
          <p className="text-sm">Failed to load profile data. Please try again later.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {(error as unknown as Error).message}
          </p>
        </div>
      </Shell>
    );
  }

  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const youtubeConnected = youtubeStatus?.connected ?? false;
  const youtubeChannelId = youtubeStatus?.channelId ?? null;

  return (
    <Shell>
      <PageHeader
        eyebrow={memberSince ? `Member since ${memberSince}` : ""}
        title="Your profile"
        description="Your trust score decides how much of the squad's attention you can receive each week."
        action={
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium"
          >
            <Settings2 className="size-4" /> Settings
          </Link>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="surface p-6">
          <div className="flex items-center gap-4">
            <span className="grid size-16 place-items-center overflow-hidden rounded-full bg-accent font-display text-3xl text-accent-foreground">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="size-full object-cover" />
              ) : (
                initials
              )}
            </span>
            <div>
              <h2 className="text-3xl leading-none">{displayName}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Youtube className="size-4 text-primary" /> {profile?.email ?? currentUser.handle}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm">
              <span>Level {level}</span>
              <span className="text-muted-foreground">
                {xpPct !== null ? `${xpPct}% to level ${level + 1}` : "Loading XP..."}
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${xpPct ?? 0}%` }}
              />
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            {[
              ["Rank", `#${currentUser.rank}`],
              ["Niche", currentUser.niche],
              ["Subs given", String(currentUser.subsGiven)],
              ["Subs received", String(currentUser.subsReceived)],
              ["Watch minutes", String(currentUser.watchMinutes)],
              ["Streak", `${streak} days`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-secondary/60 p-3">
                <dt className="text-xs uppercase tracking-widest text-muted-foreground">{k}</dt>
                <dd className="mt-1 text-base font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Trust score"
              value={`${currentUser.trustScore}%`}
              hint="No flags in the last 60 days"
            />
            <StatCard
              label="Points balance"
              value={balance.toLocaleString()}
              hint="Spend on queue priority"
              icon={<Flame className="size-4" />}
            />
          </div>

          <section className="surface p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-3xl">
                <Youtube className="size-5 text-accent" /> YouTube
              </h2>
              {youtubeConnected ? (
                <button
                  type="button"
                  onClick={() => setShowDisconnectDialog(true)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => connectYouTube.mutate()}
                  disabled={connectYouTube.isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {connectYouTube.isPending ? "Connecting..." : "Connect YouTube"}
                </button>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {youtubeConnected
                ? `Connected${youtubeChannelId ? ` as ${youtubeChannelId}` : ""}. Subscription verification is active.`
                : "Connect your YouTube account to enable subscription verification and earn rewards."}
            </p>
          </section>

          <section className="surface p-6">
            <h2 className="flex items-center gap-2 text-3xl">
              <Award className="size-5 text-accent" /> Badges
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {badges.map((b) => (
                <div
                  key={b.name}
                  className={cn(
                    "rounded-lg border border-border p-4",
                    b.earned ? "bg-secondary/60" : "bg-card opacity-60",
                  )}
                >
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {b.earned ? (
                      <Award className="size-4 text-accent" />
                    ) : (
                      <Lock className="size-4 text-muted-foreground" />
                    )}
                    {b.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{b.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="surface p-6">
            <h2 className="text-3xl">History</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {activity.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span>
                    {a.who ? (
                      <>
                        <span className="font-medium">{a.who}</span>{" "}
                      </>
                    ) : null}
                    <span className="text-muted-foreground">{a.what}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{a.when}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {showDisconnectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="surface max-w-md p-6">
            <h3 className="text-xl font-semibold">Disconnect YouTube?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This will stop subscription verification. You can reconnect anytime.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDisconnectDialog(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => disconnectYouTube.mutate()}
                disabled={disconnectYouTube.isPending}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {disconnectYouTube.isPending ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
