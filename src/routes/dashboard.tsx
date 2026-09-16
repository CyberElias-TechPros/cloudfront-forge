import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, Eye, Flame, Target, Trophy, Users } from "lucide-react";
import { PageHeader, Shell, StatCard, Thumb } from "@/components/page-parts";
import {
  useXp,
  useStreaks,
  useCurrentMember,
  useQueueTasks,
  useSubmissions,
  useActivity,
  useDailyQuests,
} from "@/hooks/use-api";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — LoopSquad" },
      {
        name: "description",
        content:
          "Your daily quests, watch queue progress, points balance and squad activity in one place.",
      },
      { property: "og:title", content: "Dashboard — LoopSquad" },
      {
        property: "og:description",
        content: "Daily quests, points, streaks and squad activity for your creator group.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: xp, isLoading: xpLoading, isError: xpError } = useXp();
  const { data: streaks, isLoading: streaksLoading, isError: streaksError } = useStreaks();
  const { data: member, isLoading: memberLoading, isError: memberError } = useCurrentMember();
  const { data: tasks = [], isLoading: tasksLoading, isError: tasksError } = useQueueTasks();
  const {
    data: submissions = [],
    isLoading: submissionsLoading,
    isError: submissionsError,
  } = useSubmissions();
  const { data: activity = [], isLoading: activityLoading, isError: activityError } = useActivity();
  const { data: dailyQuests, isLoading: questsLoading, isError: questsError } = useDailyQuests();

  const loading =
    xpLoading ||
    streaksLoading ||
    memberLoading ||
    tasksLoading ||
    submissionsLoading ||
    activityLoading ||
    questsLoading;

  if (loading) {
    return (
      <Shell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
          </div>
        </div>
      </Shell>
    );
  }

  const error =
    xpError ||
    streaksError ||
    memberError ||
    tasksError ||
    submissionsError ||
    activityError ||
    questsError;
  if (error) {
    return (
      <Shell>
        <PageHeader eyebrow="" title="Dashboard" description="" />
        <div className="mt-6 surface p-6 text-center text-destructive">
          <p className="text-sm">Failed to load dashboard data. Please try again later.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {(error as unknown as Error).message}
          </p>
        </div>
      </Shell>
    );
  }

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

  const points = xp?.totalXp ?? currentUser.points;
  const streak = streaks?.currentStreak ?? currentUser.streak;

  return (
    <Shell>
      <PageHeader
        eyebrow={`Level ${currentUser.level} · ${currentUser.niche}`}
        title={`Welcome back, ${currentUser.name.split(" ")[0]}`}
        description={
          tasks.length > 0
            ? `${tasks.length} videos are ready for your attention. Keep the loop moving.`
            : "Your next best move will appear here as your squad starts the loop."
        }
        action={
          <Link
            to="/queue"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Continue watching
          </Link>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Points"
          value={points.toLocaleString()}
          hint={points > 0 ? `${points} total` : "Earn by watching"}
          icon={<Trophy className="size-4" />}
        />
        <StatCard
          label="Streak"
          value={`${streak} days`}
          hint={streak > 0 ? "Keep it up!" : "Start watching to build streak"}
          icon={<Flame className="size-4" />}
        />
        <StatCard
          label="Give / Take ratio"
          value={`${(currentUser.subsGiven / Math.max(1, currentUser.subsReceived)).toFixed(2)}`}
          hint={
            currentUser.subsGiven / Math.max(1, currentUser.subsReceived) >= 0.9
              ? "Healthy"
              : "Watch more to improve"
          }
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Trust score"
          value={`${currentUser.trustScore}%`}
          hint={currentUser.trustScore >= 90 ? "Excellent" : "Build by verified watches"}
          icon={<Eye className="size-4" />}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="surface p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-3xl">Today&apos;s quests</h2>
            <span className="text-right text-xs uppercase tracking-widest text-muted-foreground">
              resets at midnight UTC
            </span>
          </div>
          {dailyQuests?.items.length ? (
            <ul className="mt-5 space-y-4">
              {dailyQuests.items.map((quest) => {
                const pct = Math.min(
                  100,
                  Math.round((quest.progress / Math.max(1, quest.targetCount)) * 100),
                );
                const labels: Record<string, string> = {
                  watchVideos: "Watch squad videos",
                  giveReviews: "Complete a peer review",
                  submitVideo: "Submit a video",
                };
                return (
                  <li key={quest.id}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className={pct === 100 ? "text-success" : ""}>
                        {labels[quest.questType] ?? quest.questType}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {Math.min(quest.progress, quest.targetCount)}/{quest.targetCount} · +
                        {quest.rewardXp} XP
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={pct === 100 ? "h-full bg-success" : "h-full bg-primary"}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              No daily quests are active yet —{" "}
              <Link to="/missions" className="text-foreground underline underline-offset-4">
                browse missions
              </Link>{" "}
              to keep earning XP.
            </p>
          )}

          <h3 className="mt-8 text-2xl">Next in your queue</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {tasks.slice(0, 2).map((t) => (
              <Link key={t.id} to="/queue" className="group block">
                <Thumb hue={t.thumbHue} label={t.niche} />
                <p className="mt-3 line-clamp-2 text-sm font-medium group-hover:text-accent">
                  {t.title}
                </p>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="size-3.5" /> watch {Math.round(t.requiredSec / 60)} min · +
                  {t.reward} pts
                </p>
              </Link>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <section className="surface p-6">
            <h2 className="text-3xl">Your videos in rotation</h2>
            <ul className="mt-4 space-y-4">
              {submissions.map((s) => (
                <li key={s.id} className="rounded-lg bg-secondary/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{s.title}</p>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {s.status}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${(s.watchers / s.target) * 100}%` }}
                    />
                  </div>
                  <p className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Target className="size-3.5" /> {s.watchers}/{s.target} watches
                    </span>
                    <span>{s.subs} subs</span>
                    <span>{s.comments} comments</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface p-6">
            <h2 className="text-3xl">Squad activity</h2>
            <ul className="mt-4 space-y-3">
              {activity.map((a, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="flex-1">
                    {a.who ? (
                      <>
                        <span className="font-medium">{a.who}</span>{" "}
                      </>
                    ) : null}
                    <span className="text-muted-foreground">{a.what}</span>
                    <span className="block text-xs text-muted-foreground">{a.when}</span>
                  </span>
                  {a.points ? (
                    <span
                      className={
                        a.points.startsWith("-")
                          ? "text-sm text-destructive"
                          : "text-sm text-success"
                      }
                    >
                      {a.points}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </Shell>
  );
}
