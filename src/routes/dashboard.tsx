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

const quests = [
  { label: "Watch 3 squad videos", done: 2, total: 3, reward: 50 },
  { label: "Subscribe to 2 new channels", done: 2, total: 2, reward: 30 },
  { label: "Leave 3 genuine comments", done: 1, total: 3, reward: 40 },
  { label: "Keep your streak alive", done: 1, total: 1, reward: 25 },
];

function Dashboard() {
  const { data: xp } = useXp();
  const { data: streaks } = useStreaks();
  const { data: member } = useCurrentMember();
  const { data: tasks = [] } = useQueueTasks();
  const { data: submissions = [] } = useSubmissions();
  const { data: activity = [] } = useActivity();

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
        description="You are 2 verified watches away from unlocking priority placement for tomorrow's queue."
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
          hint="+180 today"
          icon={<Trophy className="size-4" />}
        />
        <StatCard
          label="Streak"
          value={`${streak} days`}
          hint="1 day to Streak Keeper badge"
          icon={<Flame className="size-4" />}
        />
        <StatCard
          label="Give / Take ratio"
          value={`${(currentUser.subsGiven / currentUser.subsReceived).toFixed(2)}`}
          hint="Healthy — above 0.90"
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Trust score"
          value={`${currentUser.trustScore}%`}
          hint="Top 10% of the squad"
          icon={<Eye className="size-4" />}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl">Today&apos;s quests</h2>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              resets in 4h 12m
            </span>
          </div>
          <ul className="mt-5 space-y-4">
            {quests.map((q) => {
              const pct = Math.round((q.done / q.total) * 100);
              return (
                <li key={q.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className={pct === 100 ? "text-success" : ""}>{q.label}</span>
                    <span className="text-muted-foreground">
                      {q.done}/{q.total} · +{q.reward} pts
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
                    <span className="font-medium">{a.who}</span>{" "}
                    <span className="text-muted-foreground">{a.what}</span>
                    <span className="block text-xs text-muted-foreground">{a.when}</span>
                  </span>
                  <span
                    className={
                      a.points.startsWith("-") ? "text-sm text-destructive" : "text-sm text-success"
                    }
                  >
                    {a.points}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </Shell>
  );
}
