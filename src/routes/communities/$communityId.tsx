import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Copy, Shield, ShieldCheck, UserPlus, Users } from "lucide-react";
import { PageHeader, Shell } from "@/components/page-parts";
import { useCommunity } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/communities/$communityId")({
  head: ({ params }) => {
    return {
      meta: [
        { title: "Community — LoopSquad" },
        { name: "description", content: "View community details and members." },
      ],
    };
  },
  component: CommunityDetail,
});

function CommunityDetail() {
  const { communityId } = Route.useParams();
  const { data: detail, isLoading } = useCommunity(communityId);

  if (isLoading) {
    return (
      <Shell>
        <div className="py-12 text-center text-sm text-muted-foreground">Loading community…</div>
      </Shell>
    );
  }

  if (!detail) {
    return (
      <Shell>
        <div className="py-12 text-center">
          <Users className="mx-auto size-12 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Community not found.</p>
          <Link
            to="/communities"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Back to communities
          </Link>
        </div>
      </Shell>
    );
  }

  const community = detail.community;
  const members = detail.members.map((m) => ({
    id: m.id,
    name: m.displayName ?? "Member",
    handle: "@" + (m.displayName ?? "member").toLowerCase().replace(/\s+/g, ""),
    role: m.role,
    avatar: (m.displayName?.[0] ?? "?").toUpperCase(),
    points: null as number | null,
    trustScore: null as number | null,
  }));

  return (
    <Shell>
      <div className="mb-4">
        <Link
          to="/communities"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to communities
        </Link>
      </div>

      <PageHeader
        eyebrow={community.isOwner ? "You own this community" : "Member"}
        title={community.name}
        description={community.description ?? "No description available."}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
              <Users className="size-4 text-muted-foreground" />
              <span>
                {community.memberCount}/{community.maxMembers}
              </span>
            </div>
            {community.isOwner && community.inviteCode ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium"
                onClick={async () => {
                  await navigator.clipboard.writeText(community.inviteCode ?? "");
                  void 0;
                }}
              >
                <Copy className="size-4" /> Invite: {community.inviteCode}
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <UserPlus className="size-4" /> Invite member
            </button>
          </div>
        }
      />

      <div className="mt-6 space-y-6">
        <section className="surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-3xl">Members</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {community.isPublic ? (
                <ShieldCheck className="size-4 text-success" />
              ) : (
                <Shield className="size-4" />
              )}
              {community.isPublic ? "Public" : "Private"} community
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                <th className="p-4">#</th>
                <th className="p-4">Member</th>
                <th className="p-4">Role</th>
                <th className="p-4">Points</th>
                <th className="p-4">Trust</th>
              </tr>
            </thead>
            <tbody>
              {members
                .sort((a, b) => (b.points ?? -1) - (a.points ?? -1))
                .map((m, i) => (
                  <tr
                    key={m.id}
                    className={cn(
                      "border-b border-border/60 last:border-0",
                      m.id === "me" && "bg-accent/5",
                    )}
                  >
                    <td className="p-4 font-display text-xl">{i + 1}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold">
                          {m.avatar}
                        </span>
                        <div>
                          <p className="font-medium">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{m.handle}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">{m.role}</td>
                    <td className="p-4">{m.points?.toLocaleString() ?? "—"}</td>
                    <td className="p-4">
                      {m.trustScore !== null ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs",
                            m.trustScore >= 90
                              ? "bg-success/15 text-success"
                              : m.trustScore >= 75
                                ? "bg-warning/15 text-warning"
                                : "bg-destructive/15 text-destructive",
                          )}
                        >
                          {m.trustScore}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>

        <section className="surface p-6">
          <h2 className="mb-4 text-3xl">Submission rules</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-accent" />
              Videos must be from your own channel only.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-accent" />
              Minimum 3 minutes watch time.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-accent" />
              No clickbait titles or misleading thumbnails.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-accent" />
              Each member can submit up to 2 videos per week.
            </li>
          </ul>
        </section>
      </div>
    </Shell>
  );
}
