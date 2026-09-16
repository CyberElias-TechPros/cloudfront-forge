import { createFileRoute, Link } from "@tanstack/react-router";
import { LifeBuoy, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, Shell } from "@/components/page-parts";
import { Button } from "@/components/ui/button";
import { useSubmitSupport, useCurrentMember } from "@/hooks/use-api";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — LoopSquad" },
      {
        name: "description",
        content: "Get help with your LoopSquad account, credits, communities or videos.",
      },
    ],
  }),
  component: Support,
});

const TOPICS = [
  { value: "account", label: "Account & sign-in" },
  { value: "credits", label: "Credits & top-ups" },
  { value: "community", label: "Communities" },
  { value: "video", label: "Videos & queue" },
  { value: "moderation", label: "Reports, appeals & moderation" },
  { value: "bug", label: "Something is broken" },
  { value: "other", label: "Something else" },
] as const;

function Support() {
  const { data: member } = useCurrentMember();
  const submitSupport = useSubmitSupport();
  const [topic, setTopic] = useState<(typeof TOPICS)[number]["value"]>("account");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 10) {
      toast.error("Please describe the problem in at least 10 characters");
      return;
    }
    try {
      await submitSupport.mutateAsync({ topic, message: message.trim() });
      setSent(true);
      toast.success("Request sent — the team will get back to you");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send your request");
    }
  };

  return (
    <Shell>
      <PageHeader
        eyebrow="We're here to help"
        title="Support"
        description="Lost a top-up, missing rewards, locked out, or something just looks wrong? Send the team a note — every request lands in the admin console."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="surface p-6">
          {sent ? (
            <div className="py-8 text-center">
              <LifeBuoy className="mx-auto size-12 text-success" />
              <h2 className="mt-4 text-2xl font-semibold">Request received</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Thanks{member?.name ? `, ${member.name.split(" ")[0]}` : ""} — we'll reply by
                notification or email. If it's urgent, submit another request with more detail.
              </p>
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => {
                  setSent(false);
                  setMessage("");
                }}
              >
                Send another request
              </Button>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)}>
              <label className="block text-sm font-medium">What do you need help with?</label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value as (typeof TOPICS)[number]["value"])}
                className="mt-2 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                {TOPICS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              <label className="mt-5 block text-sm font-medium" htmlFor="support-message">
                Tell us what happened
              </label>
              <textarea
                id="support-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                maxLength={2000}
                placeholder="Include dates, amounts and anything you already tried. The more specific, the faster we can help."
                className="mt-2 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">{message.length}/2000</p>

              <Button type="submit" className="mt-4" disabled={submitSupport.isPending}>
                <Send className="size-4 mr-2" />
                {submitSupport.isPending ? "Sending..." : "Send request"}
              </Button>
            </form>
          )}
        </section>

        <div className="space-y-6">
          <section className="surface p-6">
            <h2 className="text-2xl">Before you write</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                • <span className="text-foreground">Missing watch rewards?</span> Claims only pay
                once the watch verifies — check your activity after a few minutes.
              </li>
              <li>
                • <span className="text-foreground">Top-up not approved yet?</span> Transfers are
                reviewed manually, usually within one business day.
              </li>
              <li>
                • <span className="text-foreground">Reported someone or appealing a report?</span>{" "}
                Appeals are reviewed by the moderation team in order.
              </li>
            </ul>
          </section>
          <section className="surface p-6">
            <h2 className="text-2xl">House rules</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Rewards exist for genuine attention only. Attempts to game the loop put the whole
              squad's channels at risk — read the{" "}
              <Link to="/rules" className="text-foreground underline underline-offset-4">
                rules
              </Link>{" "}
              to stay safe.
            </p>
          </section>
        </div>
      </div>
    </Shell>
  );
}
