import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Eye,
  Flame,
  Gauge,
  ListChecks,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { Shell } from "@/components/page-parts";
import { AdSlot } from "@/components/ad-slot";
import { useLeaderboard } from "@/hooks/use-api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LoopSquad — Creator Feedback & Growth Community" },
      {
        name: "description",
        content:
          "A community where YouTube creators give each other real feedback: watch, comment and grow together, with creator insights to track your channel.",
      },
      { property: "og:title", content: "LoopSquad — Creator Feedback & Growth Community" },
      {
        property: "og:description",
        content:
          "Real feedback and mutual support from fellow creators, plus creator insights to track your growth.",
      },
    ],
  }),
  component: Landing,
});

const steps = [
  {
    icon: ListChecks,
    title: "Drop your video",
    body: "Submit one link per day. It enters the group queue with a fair-rotation slot so everybody gets front-page time.",
  },
  {
    icon: Eye,
    title: "Watch for real",
    body: "The player tracks watch time with random attention checks. Skipping, muting or tab-switching stops the timer.",
  },
  {
    icon: BadgeCheck,
    title: "Subscribe & comment",
    body: "Confirm your subscribe and leave a genuine comment. Both are verified before points are released.",
  },
  {
    icon: Trophy,
    title: "Earn and spend points",
    body: "Points buy you queue priority. Give more than you take or your video quietly drops down the list.",
  },
];

const features = [
  {
    icon: ShieldCheck,
    title: "Anti-cheat by design",
    body: "Trust score per member, watch-time proofs, unsubscribe sweeps and a ratio rule: you can never receive more than you give.",
  },
  {
    icon: Gauge,
    title: "Balanced rotation",
    body: "Queue order is decided by contribution, not by who shouts loudest in the group chat.",
  },
  {
    icon: Flame,
    title: "Streaks and quests",
    body: "Daily quests, weekly squad goals and badge unlocks keep the group active after the first excitement fades.",
  },
  {
    icon: Users,
    title: "Built for WhatsApp squads",
    body: "Join with a group invite code, one channel per member, and a weekly recap card you can paste back into the chat.",
  },
];

function Landing() {
  const { data: leaderboard = [], isError: leaderboardError } = useLeaderboard();
  const boardItems = leaderboard.slice(0, 5).map((m) => ({
    id: m.id,
    name: m.displayName ?? "Member",
    sub: `${m.reputation}% trust`,
    points: m.totalXp,
  }));

  return (
    <>
      <Shell className="pt-14">
        <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-accent">
              <Flame className="size-3.5" /> For WhatsApp creator groups
            </span>
            <h1 className="mt-5 text-6xl leading-[0.95] sm:text-7xl">
              Grow together.
              <br />
              <span className="text-gradient">Nobody gets cheated.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground">
              LoopSquad helps your creator group support each other for real: members watch your
              videos, leave genuine feedback, and share what works — with creator insights to track
              your growth.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
              >
                Enter your squad <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/rules"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                See the fairness rules
              </Link>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
              {[
                ["128", "active members"],
                ["4.9k", "verified watches"],
                ["0", "unsubscribe cheats"],
              ].map(([v, k]) => (
                <div key={k}>
                  <dt className="font-display text-4xl leading-none">{v}</dt>
                  <dd className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                    {k}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="surface glow-ring p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              This week&apos;s squad board
            </p>
            <ul className="mt-4 space-y-3">
              {leaderboardError ? (
                <li className="rounded-lg bg-secondary/60 p-3 text-sm text-muted-foreground">
                  Leaderboard unavailable right now — try again in a moment.
                </li>
              ) : null}
              {boardItems.map((m, i) => {
                const avatar = (m.name[0] ?? "?").toUpperCase();
                return (
                  <li key={m.id} className="flex items-center gap-3 rounded-lg bg-secondary/60 p-3">
                    <span className="grid size-8 place-items-center rounded-md bg-background font-display text-lg">
                      {i + 1}
                    </span>
                    <span className="grid size-9 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                      {avatar}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{m.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{m.sub}</span>
                    </span>
                    <span className="text-right">
                      <span className="block font-display text-xl leading-none">{m.points}</span>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        pts
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="text-4xl">How the loop works</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.title} className="surface p-5">
                <div className="flex items-center justify-between">
                  <s.icon className="size-5 text-primary" />
                  <span className="font-display text-3xl text-muted-foreground/40">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-2xl">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="surface flex gap-4 p-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-secondary text-accent">
                <f.icon className="size-5" />
              </span>
              <div>
                <h3 className="text-2xl">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </div>
            </div>
          ))}
        </section>

        <AdSlot className="mt-16" />

        <section className="surface mt-16 flex flex-col items-center gap-4 p-10 text-center">
          <h2 className="text-4xl sm:text-5xl">Ready to make the group actually work?</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Paste your group invite code, connect your channel, and start the first 7-day growth
            sprint with your squad.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            Start the sprint <ArrowRight className="size-4" />
          </Link>
        </section>
      </Shell>
    </>
  );
}
