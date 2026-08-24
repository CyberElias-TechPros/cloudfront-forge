import { createFileRoute } from "@tanstack/react-router";
import { Crown, Flame, Medal, TrendingUp } from "lucide-react";
import { useState } from "react";
import { PageHeader, Shell, StatCard } from "@/components/page-parts";
import { useLeaderboard } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — LoopSquad" },
      {
        name: "description",
        content:
          "Weekly squad rankings by points, verified watch minutes, subscribes given and trust score.",
      },
      { property: "og:title", content: "Leaderboard — LoopSquad" },
      {
        property: "og:description",
        content: "See who actually shows up: points, watch minutes, subs given and trust score.",
      },
    ],
  }),
  component: Leaderboard,
});

const ranges = ["This week", "This month", "All time"] as const;
const cohorts = [
  { key: "", label: "All" },
  { key: "rookie", label: "Rookies" },
  { key: "rising", label: "Rising" },
  { key: "veteran", label: "Veterans" },
] as const;

function Leaderboard() {
  const [range, setRange] = useState<(typeof ranges)[number]>("This week");
  const [cohort, setCohort] = useState<string>("");
  const { data: entries = [], isLoading } = useLeaderboard(cohort);

  const sorted = [...entries].sort((a, b) => b.totalXp - a.totalXp);
  const top = sorted.slice(0, 3);

  return (
    <Shell>
      <PageHeader
        eyebrow="Squad standings"
        title="Leaderboard"
        description="Points come from verified watches, subscribes given and honest comments — never from posting links."
        action={
          <div className="flex gap-2">
            {ranges.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-full border border-border px-3 py-1.5 text-xs",
                  range === r
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        }
      />

      <div className="mt-4 flex gap-2">
        {cohorts.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCohort(c.key)}
            className={cn(
              "rounded-full border border-border px-3 py-1.5 text-xs",
              cohort === c.key
                ? "bg-accent text-accent-foreground"
                : "bg-card text-muted-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {isLoading ? (
          <div className="surface col-span-full flex items-center justify-center py-12 text-sm text-muted-foreground">
            Loading leaderboard...
          </div>
        ) : null}
        {top.map((m, i) => (
          <div key={m.id} className={cn("surface p-6 text-center", i === 0 && "glow-ring")}>
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-accent font-display text-2xl text-accent-foreground">
              {m.photoUrl ? (
                <img src={m.photoUrl} alt="" className="size-full rounded-full object-cover" />
              ) : (
                (m.displayName ?? "?")[0]
              )}
            </span>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-lg font-medium">
              {i === 0 ? (
                <Crown className="size-4 text-accent" />
              ) : (
                <Medal className="size-4 text-muted-foreground" />
              )}
              {m.displayName ?? "Unnamed creator"}
            </p>
            <p className="text-xs text-muted-foreground">{m.reputation}% trust</p>
            <p className="mt-3 font-display text-5xl leading-none">{m.totalXp}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">points</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Squad watch minutes"
          value="3,343"
          hint={range}
          icon={<TrendingUp className="size-4" />}
        />
        <StatCard
          label="Subs exchanged"
          value="546"
          hint="98% still active"
          icon={<Flame className="size-4" />}
        />
        <StatCard label="Cheat flags" value="3" hint="2 resolved, 1 under review" />
      </div>

      <div className="surface mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
              <th className="p-4">#</th>
              <th className="p-4">Member</th>
              <th className="p-4">Niche</th>
              <th className="p-4">Points</th>
              <th className="p-4">Watch min</th>
              <th className="p-4">Subs given</th>
              <th className="p-4">Streak</th>
              <th className="p-4">Trust</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, i) => (
              <tr key={m.id} className="border-b border-border/60 last:border-0">
                <td className="p-4 font-display text-xl">{i + 1}</td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold">
                      {m.displayName?.[0] ?? "?"}
                    </span>
                    <div>
                      <p className="font-medium">{m.displayName ?? "Unnamed creator"}</p>
                      <p className="text-xs text-muted-foreground">{m.id}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-muted-foreground">—</td>
                <td className="p-4">{m.totalXp}</td>
                <td className="p-4 text-muted-foreground">—</td>
                <td className="p-4 text-muted-foreground">—</td>
                <td className="p-4">—</td>
                <td className="p-4">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs",
                      m.reputation >= 90
                        ? "bg-success/15 text-success"
                        : m.reputation >= 75
                          ? "bg-warning/15 text-warning"
                          : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {m.reputation}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
