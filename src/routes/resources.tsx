import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Eye, Lightbulb, MessageCircle, Target } from "lucide-react";
import { PageHeader, Shell } from "@/components/page-parts";
import { AdSlot } from "@/components/ad-slot";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Creator Resources — LoopSquad" },
      {
        name: "description",
        content:
          "Practical, honest playbooks for YouTube creators: titles, thumbnails, watch time and community feedback.",
      },
      { property: "og:title", content: "Creator Resources — LoopSquad" },
      {
        property: "og:description",
        content: "Practical playbooks for titles, thumbnails and watch time.",
      },
    ],
  }),
  component: Resources,
});

const guides = [
  {
    icon: Target,
    title: "Write titles people click (without lying)",
    body: "Promise one specific outcome. Instead of 'My New Video', try 'How I Fixed My Audio in 10 Minutes'. A title should tell the viewer exactly what they'll get — and the video has to deliver it. Clickbait works once; honesty compounds.",
    points: [
      "Lead with the specific benefit or transformation.",
      "Keep it under ~60 characters so it doesn't get cut off.",
      "Test two titles and let early watch time tell you which wins.",
    ],
  },
  {
    icon: Lightbulb,
    title: "Thumbnails that earn the click",
    body: "A thumbnail is a promise about the video. Use one clear subject, high contrast, and at most a few words. Zoom out to phone size — if you can't read it at 120px wide, simplify it.",
    points: [
      "One subject, one idea, minimal text.",
      "Match the thumbnail to the title (consistency builds trust).",
      "Avoid reusing the same face/frame across videos — variety reads as honesty.",
    ],
  },
  {
    icon: Eye,
    title: "Earn real watch time",
    body: "YouTube promotes videos that keep viewers watching. Structure helps: open with the payoff, deliver on it early, and cut dead air. Watch time from people who genuinely chose to watch is the metric that compounds.",
    points: [
      "Front-load the answer, then go deeper.",
      "Cut anything that doesn't serve the video's one promise.",
      "Ask a question mid-video to keep attention honest.",
    ],
  },
  {
    icon: MessageCircle,
    title: "Get feedback that actually helps",
    body: "Generic 'nice video' comments feel good and teach nothing. Ask for something specific: pacing, audio, whether the intro held attention. On LoopSquad, leave the same quality of feedback you want to receive.",
    points: [
      "Ask for feedback on one specific thing, not 'everything'.",
      "Give concrete feedback — what worked and one thing to improve.",
      "Review the video, not the person.",
    ],
  },
];

function Resources() {
  return (
    <Shell>
      <PageHeader
        eyebrow="Creator playbook"
        title="Resources"
        description="Honest, practical guides to grow as a creator — no shortcuts, just the fundamentals that compound."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {guides.map((g) => (
          <div key={g.title} className="surface flex flex-col gap-4 p-6">
            <span className="grid size-11 place-items-center rounded-lg bg-secondary text-accent">
              <g.icon className="size-5" />
            </span>
            <div>
              <h2 className="text-2xl">{g.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{g.body}</p>
              <ul className="mt-4 space-y-2">
                {g.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <BookOpen className="mt-0.5 size-3.5 shrink-0 text-accent" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <AdSlot className="mt-6" />
    </Shell>
  );
}
