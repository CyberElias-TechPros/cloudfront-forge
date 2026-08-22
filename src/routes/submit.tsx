import { createFileRoute } from "@tanstack/react-router";
import { Info, Link2, Sparkles, Timer } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageHeader, Shell } from "@/components/page-parts";
import { useSubmissions, useSubmitVideo } from "@/hooks/use-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/submit")({
  head: () => ({
    meta: [
      { title: "Submit a Video — LoopSquad" },
      {
        name: "description",
        content:
          "Drop one YouTube link a day into the squad queue, set the watch target and spend points for priority placement.",
      },
      { property: "og:title", content: "Submit a Video — LoopSquad" },
      {
        property: "og:description",
        content: "Add your video to the fair-rotation queue and set your watch target.",
      },
    ],
  }),
  component: Submit,
});

const niches = ["Tech", "Food", "Fitness", "Beauty", "Gaming", "Music", "Podcast", "DIY"];
const boosts = [
  { label: "Standard", cost: 0, desc: "Normal rotation slot, usually live within 2 hours." },
  { label: "Priority", cost: 120, desc: "Jump to the top half of the queue for 24 hours." },
  { label: "Spotlight", cost: 300, desc: "Pinned on the dashboard hero for the whole day." },
];

function Submit() {
  const { data: submissions = [] } = useSubmissions();
  const submitVideo = useSubmitVideo();
  const [niche, setNiche] = useState("Tech");
  const [boost, setBoost] = useState("Standard");
  const [link, setLink] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!link) {
      toast.error("Paste your YouTube link first.");
      return;
    }
    try {
      await submitVideo.mutateAsync({ youtubeUrl: link });
      toast.success("Video submitted to the squad queue!");
      setLink("");
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Could not submit right now. Check the link and try again.");
    }
  };

  return (
    <Shell>
      <PageHeader
        eyebrow="One link per day"
        title="Submit a video"
        description="Your submission only goes live once your give/take ratio is healthy — that's what keeps the loop fair."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <form className="surface space-y-6 p-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="url" className="text-sm font-medium">
              YouTube video link
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-background px-3">
              <Link2 className="size-4 text-muted-foreground" />
              <input
                id="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div>
            <label htmlFor="title" className="text-sm font-medium">
              Title shown to the squad
            </label>
            <input
              id="title"
              placeholder="Tecno Camon 40 — 3 weeks later, honest review"
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <p className="text-sm font-medium">Niche</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {niches.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNiche(n)}
                  className={cn(
                    "rounded-full border border-border px-3 py-1.5 text-xs",
                    niche === n
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Timer className="size-4 text-accent" /> Fixed by platform rules
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Every video requires <span className="font-medium text-foreground">3 min verified watch (180s)</span> — in-focus, not muted, with random attention checks. You don’t set this; the rules do (see <a href="/rules" className="underline">Fairness Rules</a>).
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Target is automatically 20 watches per video.</p>
          </div>

          <div>
            <p className="text-sm font-medium">Placement</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {boosts.map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => setBoost(b.label)}
                  className={cn(
                    "rounded-lg border border-border p-4 text-left",
                    boost === b.label ? "border-primary bg-secondary" : "bg-card",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <Sparkles className="size-3.5 text-accent" /> {b.label}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{b.desc}</span>
                  <span className="mt-2 block text-xs text-accent">
                    {b.cost === 0 ? "Free" : `${b.cost} pts`}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitVideo.isPending}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitVideo.isPending ? "Submitting…" : "Add to the queue"}
          </button>
        </form>

        <div className="space-y-6">
          <section className="surface p-6">
            <h2 className="flex items-center gap-2 text-2xl">
              <Info className="size-4 text-accent" /> Before you submit
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>· One video per member per 24 hours.</li>
              <li>· Your give/take ratio must stay above 0.80.</li>
              <li>· Videos under 2 minutes can&apos;t set a 3-minute watch target.</li>
              <li>· Clickbait reports from 3 members pull the video from rotation.</li>
            </ul>
          </section>

          <section className="surface p-6">
            <h2 className="flex items-center gap-2 text-2xl">
              <Timer className="size-4 text-accent" /> Your recent submissions
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              {submissions.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block font-medium">{s.title}</span>
                    <span className="text-xs text-muted-foreground">{s.postedAgo}</span>
                  </span>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {s.status}
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
