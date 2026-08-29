import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Shell } from "@/components/page-parts";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [{ title: "Terms of Service — LoopSquad" }, { name: "robots", content: "index,follow" }],
  }),
  component: Terms,
});

const sections = [
  {
    title: "What LoopSquad is",
    body: "LoopSquad is a community where YouTube creators exchange genuine feedback and support. Members watch each other's videos, leave real comments and reviews, and track their growth. It is not a service for buying or artificially inflating views, subscribers or engagement.",
  },
  {
    title: "Acceptable use",
    body: "You agree not to use the platform to manipulate engagement on YouTube or any other platform — including paid or coordinated subscribing, fake views, or recycled comments. You must also comply with YouTube's Terms of Service and Google's program policies for any channel you connect. Accounts that attempt to game the system are subject to removal.",
  },
  {
    title: "Points and credits",
    body: "Points (XP) and credits are in-platform currency used for queue priority and community features. They have no cash value and cannot be withdrawn or transferred. Credit top-ups purchased via bank transfer are purchases of in-platform credits only and are non-refundable once approved.",
  },
  {
    title: "Your content and conduct",
    body: "You are responsible for the content you submit and the comments and reviews you leave. Feedback must be honest and constructive. Harassment, spam, and impersonation are not allowed and may result in account suspension.",
  },
  {
    title: "No guarantees",
    body: "The platform is provided as-is. We make no guarantees about subscriber counts, view counts, or channel growth. Results depend on the quality of your content and your participation.",
  },
  {
    title: "Changes and contact",
    body: "We may update these terms from time to time; continued use after changes means you accept them. Questions can be sent to info@techpros.com.ng.",
  },
];

function Terms() {
  return (
    <Shell>
      <PageHeader
        eyebrow="Legal"
        title="Terms of Service"
        description="The ground rules for participating in the LoopSquad community."
      />
      <div className="surface mt-6 space-y-6 p-6 sm:p-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-xl">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </section>
        ))}
        <p className="text-xs text-muted-foreground">Last updated: August 2026.</p>
      </div>
    </Shell>
  );
}
