import { createFileRoute } from "@tanstack/react-router";
import { Award, Flame, Lock, Settings2, Youtube } from "lucide-react";
import { PageHeader, Shell, StatCard } from "@/components/page-parts";
import { activity, badges, currentUser } from "@/lib/mock-data";
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
  const xpPct = 62;

  return (
    <Shell>
      <PageHeader
        eyebrow="Member since Aug 2026"
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
            <span className="grid size-16 place-items-center rounded-full bg-accent font-display text-3xl text-accent-foreground">
              {currentUser.avatar}
            </span>
            <div>
              <h2 className="text-3xl leading-none">{currentUser.name}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Youtube className="size-4 text-primary" /> {currentUser.handle}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm">
              <span>Level {currentUser.level}</span>
              <span className="text-muted-foreground">{xpPct}% to level {currentUser.level + 1}</span>
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
              ["Streak", `${currentUser.streak} days`],
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
              value={currentUser.points.toLocaleString()}
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
