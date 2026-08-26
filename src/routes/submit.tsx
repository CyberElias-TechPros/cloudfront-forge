import { createFileRoute } from "@tanstack/react-router";
import { Info, Link2, Sparkles, Timer } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageHeader, Shell } from "@/components/page-parts";
import { useSubmissions, useSubmitVideo } from "@/hooks/use-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/submit")({
  validateSearch: (search: Record<string, unknown>) => ({
    link: (search["link"] as string) || undefined,
  }),
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

function Submit() {
  const search = Route.useSearch();
  const sharedLink = search["link"];
  const { data: submissions = [] } = useSubmissions();
  const submitVideo = useSubmitVideo();
  const [niche, setNiche] = useState("Tech");
  const [link, setLink] = useState(sharedLink ?? "");
  const [title, setTitle] = useState("");
  const [magicWord, setMagicWord] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!link) {
      toast.error("Paste your YouTube link first.");
      return;
    }
    try {
      const payload: { youtubeUrl: string; title?: string; magicWord?: string; niche?: string } = {
        youtubeUrl: link,
      };
      if (title.trim()) payload.title = title.trim();
      if (magicWord.trim()) payload.magicWord = magicWord.trim();
      if (niche) payload.niche = niche;
      await submitVideo.mutateAsync(payload);
      const shareText = encodeURIComponent(
        `Just submitted a video to LoopSquad! Watch and review it here: ${typeof window !== "undefined" ? window.location.origin : ""}/queue`,
      );
      toast.success("Video submitted!", {
        description: (
          <a
            href={`https://wa.me/?text=${shareText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block rounded bg-[#25d366] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            Share to WhatsApp
          </a>
        ),
        duration: 8000,
      });
      setLink("");
      setTitle("");
      setMagicWord("");
    } catch (error) {
      console.error("Submit error:", error);
      const msg = error instanceof Error ? error.message : "Could not submit right now.";
      if (msg.includes("already submitted") || msg.includes("already in the queue")) {
        toast.error("Duplicate", {
          description: "You already submitted this video or it's already in the queue.",
        });
      } else if (msg.includes("24 hours")) {
        toast.error("Daily limit", {
          description: "You can only submit one video every 24 hours.",
        });
      } else if (msg.includes("ratio") || msg.includes("RATIO")) {
        toast.error("Ratio too low", { description: msg });
      } else {
        toast.error("Submit failed", { description: msg });
      }
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
              Title shown to the squad{" "}
              <span className="text-xs text-muted-foreground">
                (optional — auto-filled from YouTube if blank)
              </span>
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tecno Camon 40 — 3 weeks later, honest review"
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <label htmlFor="magic-word" className="text-sm font-medium">
              Comment keyword{" "}
              <span className="text-xs text-muted-foreground">
                (optional — viewers include this word in their comment to prove they watched)
              </span>
            </label>
            <input
              id="magic-word"
              value={magicWord}
              onChange={(e) => setMagicWord(e.target.value)}
              placeholder="e.g. LOOPSQUAD-XK42"
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
              Every video requires a verified watch capped at 3 min (180s) — shorter videos use
              their full length; in-focus, not muted, with random attention checks. You don't set
              this; the rules do (see{" "}
              <a href="/rules" className="underline">
                Fairness Rules
              </a>
              ).
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Target is automatically 20 watches per video.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-accent" /> Want queue priority?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Buy a Boost from the{" "}
              <a href="/gamification" className="underline">
                Shop
              </a>{" "}
              to pin your video top-of-queue for 24 hours.
            </p>
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
