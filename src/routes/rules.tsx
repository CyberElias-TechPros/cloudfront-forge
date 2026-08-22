import { createFileRoute } from "@tanstack/react-router";
import { Ban, Coins, Handshake, ScrollText, ShieldCheck, Timer } from "lucide-react";
import { PageHeader, Shell } from "@/components/page-parts";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Fairness Rules & Scoring — LoopSquad" },
      {
        name: "description",
        content:
          "How points, the give/take ratio, verified watch time and anti-cheat sweeps keep the sub-for-sub loop honest.",
      },
      { property: "og:title", content: "Fairness Rules & Scoring — LoopSquad" },
      {
        property: "og:description",
        content: "Points, ratios, verification and penalties explained in plain language.",
      },
    ],
  }),
  component: Rules,
});

const scoring = [
  ["Verified watch (3 min+)", "+30 pts"],
  ["Subscribe confirmed", "+15 pts"],
  ["Genuine comment", "+20 pts"],
  ["Daily quest set complete", "+50 pts"],
  ["7-day streak bonus", "+100 pts"],
  ["Fake watch detected", "-40 pts"],
  ["Unsubscribe within 30 days", "-60 pts"],
  ["Clickbait upheld by 3 reports", "-80 pts"],
];

const sections = [
  {
    icon: Handshake,
    title: "The give/take rule",
    body: "You can never receive more than you give. Your ratio (subs given ÷ subs received) must stay above 0.80 for your videos to stay in rotation. Above 1.10 and you earn a priority slot for free.",
  },
  {
    icon: Timer,
    title: "Verified watch time",
    body: "The watch timer runs only while the video plays in a focused tab, with occasional attention checks. Muting, backgrounding, or seeking forward pauses the count.",
  },
  {
    icon: ShieldCheck,
    title: "Weekly sweeps",
    body: "Every Sunday the squad's subscriptions are re-checked. Anyone who quietly unsubscribed loses the points and drops trust score. Three sweeps failed means removal from the group.",
  },
  {
    icon: Coins,
    title: "Points are the currency",
    body: "Points buy queue priority and spotlight slots. They cannot be bought with money, transferred, or given by admins — only earned by participating.",
  },
  {
    icon: Ban,
    title: "Instant disqualifiers",
    body: "Bot traffic, duplicate accounts, recycled comments, and asking members to subscribe outside the app all trigger an immediate review and reset of the week's points.",
  },
  {
    icon: ScrollText,
    title: "Disputes",
    body: "Any member can dispute a flag once per week. Two admins plus one random high-trust member review it and the decision is posted publicly in the activity feed.",
  },
];

function Rules() {
  return (
    <Shell>
      <PageHeader
        eyebrow="Squad constitution · Platform-wide"
        title="Fairness rules"
        description="These platform rules apply to all squads. Per-community custom rules are coming soon — for now every community uses these defaults."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((s) => (
            <section key={s.title} className="surface p-6">
              <span className="grid size-10 place-items-center rounded-lg bg-secondary text-accent">
                <s.icon className="size-5" />
              </span>
              <h2 className="mt-4 text-2xl">{s.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </section>
          ))}
        </div>

        <section className="surface h-fit p-6">
          <h2 className="text-3xl">Scoring table</h2>
          <ul className="mt-4 divide-y divide-border text-sm">
            {scoring.map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-4 py-3">
                <span className="text-muted-foreground">{k}</span>
                <span
                  className={
                    v!.startsWith("-") ? "font-medium text-destructive" : "font-medium text-success"
                  }
                >
                  {v}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-lg bg-secondary/60 p-4 text-xs text-muted-foreground">
            Rule changes need a 60% vote from members with a trust score above 80. Proposals are
            posted every Friday.
          </p>
        </section>
      </div>
    </Shell>
  );
}
