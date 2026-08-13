import { createFileRoute } from "@tanstack/react-router";
import { Flame, RefreshCw, Target, Trophy, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, Shell, Thumb } from "@/components/page-parts";
import { useMissionAssignments, useCompleteMission, useCurrentMember } from "@/hooks/use-api";
import type { MissionAssignment } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/missions")({
  head: () => ({
    meta: [
      { title: "Missions — LoopSquad" },
      {
        name: "description",
        content: "Complete daily and weekly missions to earn XP, credits, and unlock badges.",
      },
      { property: "og:title", content: "Missions — LoopSquad" },
      {
        property: "og:description",
        content: "Daily quests, weekly challenges, and progressive achievements.",
      },
    ],
  }),
  component: Missions,
});

const statusColors = {
  assigned: "border-border text-muted-foreground",
  in_progress: "border-accent text-accent",
  completed: "border-success text-success",
  expired: "border-destructive/30 text-destructive",
  skipped: "border-muted text-muted-foreground",
} as const;

const difficultyColors = {
  easy: "bg-success/15 text-success",
  medium: "bg-warning/15 text-warning",
  hard: "bg-destructive/15 text-destructive",
} as const;

function Missions() {
  const [filter, setFilter] = useState<
    "all" | "assigned" | "in_progress" | "completed" | "expired"
  >("all");

  const { data: missionAssignments = [], isLoading } = useMissionAssignments();
  const completeMission = useCompleteMission();
  const { data: member } = useCurrentMember();

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

  const filtered =
    filter === "all" ? missionAssignments : missionAssignments.filter((m) => m.status === filter);

  const completed = missionAssignments.filter((m) => m.status === "completed");
  const totalXP = completed.reduce((a, m) => a + m.reward.xp, 0);
  const totalCredits = completed.reduce((a, m) => a + m.reward.credits, 0);

  const handleClaim = async (assignmentId: string) => {
    try {
      const result = await completeMission.mutateAsync(assignmentId);
      toast.success(`Reward claimed! +${result.xpAwarded} XP`);
    } catch (error) {
      console.error("Claim error:", error);
      toast.error("Could not claim reward right now.");
    }
  };

  const filters = [
    { key: "all", label: "All" },
    { key: "assigned", label: "Assigned" },
    { key: "in_progress", label: "In Progress" },
    { key: "completed", label: "Completed" },
    { key: "expired", label: "Expired" },
  ] as const;

  return (
    <Shell>
      <PageHeader
        eyebrow={`Level ${currentUser.level} · ${currentUser.niche}`}
        title="Missions"
        description="Complete quests to earn XP and credits. Streak bonuses unlock special rewards."
        action={
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-full border border-border px-3 py-1.5 text-xs",
                  filter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Active missions"
          value={missionAssignments
            .filter((m) => m.status !== "completed" && m.status !== "expired")
            .length.toString()}
          hint="In your dashboard"
          icon={<Target className="size-4" />}
        />
        <StatCard
          label="Completed"
          value={completed.length.toString()}
          hint={`${totalXP} XP earned`}
          icon={<Trophy className="size-4" />}
        />
        <StatCard
          label="Credits earned"
          value={totalCredits.toString()}
          hint="Spend on queue priority"
          icon={<Zap className="size-4" />}
        />
        <StatCard
          label="Current streak"
          value={`${currentUser.streak} days`}
          hint="Keep it going!"
          icon={<Flame className="size-4" />}
        />
      </div>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="surface flex items-center justify-center py-12 text-sm text-muted-foreground">
            Loading missions...
          </div>
        ) : null}
        {!isLoading && filtered.length === 0 ? (
          <div className="surface py-12 text-center">
            <Target className="mx-auto size-12 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">No missions match that filter.</p>
          </div>
        ) : null}
        {filtered.map((m: MissionAssignment) => {
          const pct = Math.round((m.progress / m.total) * 100);
          const isClaimable = m.status === "completed" && !m.claimed;
          return (
            <article
              key={m.id}
              className={cn(
                "surface flex items-center justify-between gap-4 p-5 transition-colors",
                isClaimable && "glow-ring",
              )}
            >
              <div className="flex items-center gap-4">
                <Thumb
                  hue={
                    m.category === "watch"
                      ? 220
                      : m.category === "subscribe"
                        ? 155
                        : m.category === "comment"
                          ? 85
                          : m.category === "submit"
                            ? 280
                            : 330
                  }
                  label={m.category}
                />
                <div>
                  <h3 className="text-xl font-medium">{m.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    <span className={cn("rounded-full border px-2 py-0.5", statusColors[m.status])}>
                      {m.status.replace("_", " ")}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5",
                        difficultyColors[m.difficulty],
                      )}
                    >
                      {m.difficulty}
                    </span>
                    <span className="text-muted-foreground">
                      Due: {new Date(m.dueAt).toLocaleDateString()}
                    </span>
                  </div>

                  {m.status === "in_progress" || m.status === "assigned" ? (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span>
                          {m.progress}/{m.total} — {m.category}
                        </span>
                        <span className="text-muted-foreground">
                          +{m.reward.xp} XP
                          {m.reward.credits > 0 ? ` · +${m.reward.credits} credits` : ""}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                {isClaimable ? (
                  <button
                    type="button"
                    onClick={() => void handleClaim(m.id)}
                    disabled={completeMission.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
                  >
                    {completeMission.isPending ? "Claiming..." : "Claim reward"}
                  </button>
                ) : m.status === "completed" && m.claimed ? (
                  <span className="text-xs uppercase tracking-widest text-success">Claimed</span>
                ) : m.status === "expired" ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
                  >
                    <RefreshCw className="size-3" /> Skip
                  </button>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  +{m.reward.xp} XP{m.reward.credits > 0 ? ` · +${m.reward.credits} credits` : ""}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </Shell>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        {icon ? <span className="text-accent">{icon}</span> : null}
      </div>
      <p className="mt-3 font-display text-4xl leading-none">{value}</p>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
