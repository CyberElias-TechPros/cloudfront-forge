import { createFileRoute } from "@tanstack/react-router";
import { Award, Flame, Lock, Settings2, Youtube } from "lucide-react";
import { PageHeader, Shell, StatCard } from "@/components/page-parts";
import {
  useMyProfile,
  useXp,
  useCredits,
  useStreaks,
  useBadges,
  useCurrentMember,
  useActivity,
} from "@/hooks/use-api";
import { cn } from "@/lib/utils";

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
  const { data: profile } = useMyProfile();
  const { data: xp } = useXp();
  const { data: credits } = useCredits();
  const { data: streaks } = useStreaks();
  const { data: badges = [] } = useBadges();
  const { data: member } = useCurrentMember();
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

  const xpPct = 62;
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
    : "Aug 2026";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Shell>
      <PageHeader
        eyebrow={`Member since ${memberSince}`}
        title="Your profile"
        description="Your trust score decides how much of the squad's attention you can receive each week."
        action={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium"
          >
            <Settings2 className="size-4" /> Settings
          </button>
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
                {xpPct}% to level {level + 1}
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-accent" style={{ width: `${xpPct}%` }} />
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
                    <span className="font-medium">{a.who}</span>{" "}
                    <span className="text-muted-foreground">{a.what}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{a.when}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </Shell>
  );
}
