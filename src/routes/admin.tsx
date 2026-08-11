import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Settings2, Users, XCircle } from "lucide-react";
import { PageHeader, Shell, StatCard } from "@/components/page-parts";
import { members, tasks } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — LoopSquad" },
      {
        name: "description",
        content:
          "Review cheat flags, moderate the queue, adjust sprint settings and manage squad membership.",
      },
      { property: "og:title", content: "Admin Console — LoopSquad" },
      {
        property: "og:description",
        content: "Cheat flags, queue moderation and sprint settings for squad admins.",
      },
    ],
  }),
  component: Admin,
});

const flags = [
  {
    member: "Segun P.",
    reason: "Watch timer completed in 12s on a 7-minute video",
    severity: "high",
    when: "2h ago",
  },
  {
    member: "Grace N.",
    reason: "Unsubscribed from 3 channels within 48 hours",
    severity: "high",
    when: "yesterday",
  },
  {
    member: "Ifeanyi D.",
    reason: "Copy-pasted the same comment on 5 videos",
    severity: "medium",
    when: "2 days ago",
  },
  {
    member: "Bola K.",
    reason: "Thumbnail reported as clickbait by 2 members",
    severity: "low",
    when: "3 days ago",
  },
];

function Admin() {
  return (
    <Shell>
      <PageHeader
        eyebrow="Moderators only"
        title="Admin console"
        description="Keep the loop honest: resolve flags, moderate the queue and tune this sprint's settings."
        action={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium"
          >
            <Settings2 className="size-4" /> Sprint settings
          </button>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Members" value="128" hint="9 joined this week" icon={<Users className="size-4" />} />
        <StatCard label="Open flags" value="4" hint="2 high severity" icon={<AlertTriangle className="size-4" />} />
        <StatCard label="Queue depth" value="17" hint="avg wait 1h 40m" />
        <StatCard label="Squad health" value="92%" hint="participation last 7 days" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="surface p-6">
          <h2 className="text-3xl">Cheat flags</h2>
          <ul className="mt-4 space-y-3">
            {flags.map((f) => (
              <li key={f.reason} className="rounded-lg bg-secondary/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{f.member}</p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest",
                      f.severity === "high"
                        ? "bg-destructive/15 text-destructive"
                        : f.severity === "medium"
                          ? "bg-warning/15 text-warning"
                          : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {f.severity}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{f.reason}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    <XCircle className="size-3.5" /> Penalise
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold"
                  >
                    <CheckCircle2 className="size-3.5" /> Dismiss
                  </button>
                  <span className="text-xs text-muted-foreground">{f.when}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="surface p-6">
            <h2 className="text-3xl">Queue moderation</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {tasks.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block line-clamp-1 font-medium">{t.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.handle} · {t.postedAgo}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface p-6">
            <h2 className="text-3xl">Low trust watchlist</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {members
                .filter((m) => m.trustScore < 90)
                .map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-3">
                      <span className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold">
                        {m.avatar}
                      </span>
                      <span>
                        <span className="block font-medium">{m.name}</span>
                        <span className="text-xs text-muted-foreground">{m.handle}</span>
                      </span>
                    </span>
                    <span className="text-sm text-warning">{m.trustScore}%</span>
                  </li>
                ))}
            </ul>
          </section>
        </div>
      </div>
    </Shell>
  );
}
