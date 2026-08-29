import { createFileRoute } from "@tanstack/react-router";
import { Handshake, User } from "lucide-react";
import { useState } from "react";
import { PageHeader, Shell } from "@/components/page-parts";
import { useCollaborators } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/collaborate")({
  head: () => ({
    meta: [
      { title: "Collaborate — LoopSquad" },
      {
        name: "description",
        content:
          "Find creators who want to collaborate, trade feedback or mentor — all opt-in via your public profile.",
      },
      { property: "og:title", content: "Collaborate — LoopSquad" },
      {
        property: "og:description",
        content: "Discover creators open to collaboration, feedback and mentorship.",
      },
    ],
  }),
  component: Collaborate,
});

const intents = [
  { id: "collaboration", label: "Collaboration" },
  { id: "feedback", label: "Feedback" },
  { id: "support", label: "Support" },
  { id: "mentorship", label: "Mentorship" },
] as const;

const intentLabels: Record<string, string> = {
  collaboration: "Open to collaboration",
  feedback: "Looking for feedback",
  support: "Looking for support",
  mentorship: "Looking for mentorship",
};

function Collaborate() {
  const [intent, setIntent] = useState<string>("collaboration");
  const { data: members = [], isLoading } = useCollaborators(intent);

  return (
    <Shell>
      <PageHeader
        eyebrow="Creator discovery"
        title="Collaborate"
        description="Find creators who want to work together — every profile here is opt-in. Set your own intent and public profile in Settings."
      />

      <div className="mt-6 flex flex-wrap gap-2">
        {intents.map((i) => (
          <button
            key={i.id}
            type="button"
            onClick={() => setIntent(i.id)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              intent === i.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-secondary",
            )}
          >
            {i.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-8 flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Finding creators...</p>
          </div>
        </div>
      ) : members.length === 0 ? (
        <div className="surface mt-8 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No public profiles with this intent yet. Be the first — set your intent to{" "}
            <span className="font-medium text-foreground">{intent}</span> in Settings.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <li key={m.id} className="surface flex items-start gap-4 p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                {m.avatar || <User className="size-5" />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {m.niche}
                  {m.experience ? ` · ${m.experience}` : ""}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-accent">
                  <Handshake className="size-3.5" />
                  {intentLabels[m.intent] ?? m.intent}
                </p>
                {m.goals ? (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{m.goals}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
