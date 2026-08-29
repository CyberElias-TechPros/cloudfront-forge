import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Shell } from "@/components/page-parts";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [{ title: "Privacy Policy — LoopSquad" }, { name: "robots", content: "index,follow" }],
  }),
  component: Privacy,
});

const sections = [
  {
    title: "What we collect",
    body: "When you sign in, we store the basic account information from your Google account (name, email, profile photo). If you connect your YouTube channel, we store the connection needed to verify actions you choose to perform. We also store activity you generate while using the platform — such as watch sessions, reviews you write, and points you earn.",
  },
  {
    title: "How we use it",
    body: "We use this information to run the community: to show you your queue, record reviews and feedback, maintain leaderboards and points, and to protect the community against abuse (for example, detecting fake engagement or duplicate accounts).",
  },
  {
    title: "Advertising and cookies",
    body: "We use Google AdSense to display advertising. Google and its partners use cookies to serve ads based on your visits to this and other websites. You can opt out of personalised advertising at Google's Ads Settings (ads.google.com), or by visiting aboutads.info. For details on how Google uses data, see Google's Privacy & Terms.",
  },
  {
    title: "Third-party services",
    body: "We rely on third-party services to operate: Firebase (authentication), Cloudflare (infrastructure and database), Google/YouTube (OAuth and advertising), and email providers for notifications. Each of these services processes data under its own privacy policy.",
  },
  {
    title: "Retention and deletion",
    body: "We keep your data only as long as needed to operate the community. You can delete your account at any time from Settings, which removes your profile. Activity already recorded in the community (such as reviews you wrote for others) may be retained in anonymised form to keep leaderboards and reputation systems accurate.",
  },
  {
    title: "Contact",
    body: "For any privacy questions or requests, contact us at info@techpros.com.ng.",
  },
];

function Privacy() {
  return (
    <Shell>
      <PageHeader
        eyebrow="Legal"
        title="Privacy Policy"
        description="What we collect, why we collect it, and how advertising works on LoopSquad."
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
