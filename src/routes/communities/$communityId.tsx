import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Copy,
  LogOut,
  RefreshCw,
  Shield,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, Shell } from "@/components/page-parts";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  useCommunity,
  useCommunityRequests,
  useReviewJoinRequest,
  useLeaveCommunity,
  useSetMemberRole,
  useRemoveMember,
  useRegenerateInvite,
  useUpdateCommunitySettings,
  useArchiveCommunity,
} from "@/hooks/use-api";

export const Route = createFileRoute("/communities/$communityId")({
  head: () => {
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
  const navigate = useNavigate();
  const { data: detail, isLoading } = useCommunity(communityId);

  const isOwner = Boolean(detail?.community.isOwner);
  const myRole = detail?.community.myRole ?? null;
  const isManager = myRole === "owner" || myRole === "admin" || myRole === "moderator";

  const { data: requests } = useCommunityRequests(communityId, isManager);
  const reviewRequest = useReviewJoinRequest();
  const leaveCommunity = useLeaveCommunity();
  const setMemberRole = useSetMemberRole();
  const removeMember = useRemoveMember();
  const regenerateInvite = useRegenerateInvite();
  const updateSettings = useUpdateCommunitySettings();
  const archiveCommunity = useArchiveCommunity();

  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

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
          <p className="mt-3 text-sm text-muted-foreground">
            Community not found (it may have been archived).
          </p>
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
  const settings = community.settings ?? {
    allowPeerReview: true,
    allowCollaboration: true,
    requireApproval: true,
    defaultLanguage: null,
  };
  const members = detail.members.map((m) => ({
    id: m.id,
    name: m.displayName ?? "Member",
    role: m.role,
    avatar: (m.displayName?.[0] ?? "?").toUpperCase(),
    joinedAt: m.joinedAt,
  }));

  const copyInvite = async () => {
    if (!community.inviteCode) return;
    await navigator.clipboard.writeText(community.inviteCode);
    toast.success("Invite code copied — share it with your creator friends");
  };

  const handleLeave = async () => {
    try {
      await leaveCommunity.mutateAsync(communityId);
      setShowLeaveDialog(false);
      toast.success(`You left ${community.name}`);
      navigate({ to: "/communities" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not leave the community");
    }
  };

  const handleArchive = async () => {
    try {
      await archiveCommunity.mutateAsync(communityId);
      setShowArchiveDialog(false);
      toast.success("Community archived");
      navigate({ to: "/communities" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not archive the community");
    }
  };

  const handleSetting = (
    key: "allowPeerReview" | "allowCollaboration" | "requireApproval",
    value: boolean,
  ) => {
    updateSettings.mutate(
      { communityId, settings: { [key]: value } },
      {
        onSuccess: () => toast.success("Community settings saved"),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Could not save settings"),
      },
    );
  };

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
        eyebrow={
          community.isOwner
            ? "You own this community"
            : myRole
              ? `Member · ${myRole}`
              : "Not a member"
        }
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
            {community.inviteCode ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium"
                onClick={() => void copyInvite()}
              >
                <Copy className="size-4" /> Invite: {community.inviteCode}
              </button>
            ) : null}
            {myRole && !community.isOwner ? (
              <button
                type="button"
                onClick={() => setShowLeaveDialog(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive"
              >
                <LogOut className="size-4" /> Leave community
              </button>
            ) : null}
          </div>
        }
      />

      <div className="mt-6 space-y-6">
        {isManager && (requests?.length ?? 0) > 0 && (
          <section className="surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-3xl">Join requests</h2>
              <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                {requests?.length ?? 0} pending
              </span>
            </div>
            <ul className="space-y-3">
              {(requests ?? []).map((req) => (
                <li
                  key={req.id}
                  className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{req.displayName ?? "Creator"}</p>
                    {req.message ? (
                      <p className="mt-1 text-sm text-muted-foreground">“{req.message}”</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Requested {new Date(req.requestedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={reviewRequest.isPending}
                      onClick={() =>
                        reviewRequest.mutate(
                          { communityId, requestId: req.id, approve: true },
                          {
                            onSuccess: () =>
                              toast.success(`${req.displayName ?? "Creator"} approved`),
                            onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
                          },
                        )
                      }
                    >
                      <Check className="size-4 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reviewRequest.isPending}
                      onClick={() =>
                        reviewRequest.mutate(
                          { communityId, requestId: req.id, approve: false },
                          {
                            onSuccess: () => toast.success("Request declined"),
                            onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
                          },
                        )
                      }
                    >
                      <X className="size-4 mr-1" /> Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

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
                <th className="p-4">Joined</th>
                {isOwner ? <th className="p-4 text-right">Manage</th> : null}
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={m.id} className="border-b border-border/60 last:border-0">
                  <td className="p-4 font-display text-xl">{i + 1}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold">
                        {m.avatar}
                      </span>
                      <p className="font-medium">{m.name}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    {isOwner && m.role !== "owner" ? (
                      <select
                        value={m.role === "moderator" ? "moderator" : "member"}
                        onChange={(e) =>
                          setMemberRole.mutate(
                            {
                              communityId,
                              userId: m.id,
                              role: e.target.value as "member" | "moderator",
                            },
                            {
                              onSuccess: () => toast.success(`Role updated for ${m.name}`),
                              onError: (err) =>
                                toast.error(
                                  err instanceof Error ? err.message : "Failed to update role",
                                ),
                            },
                          )
                        }
                        className="rounded-md border border-border bg-card px-2 py-1 text-xs"
                      >
                        <option value="member">member</option>
                        <option value="moderator">moderator</option>
                      </select>
                    ) : (
                      <span className="text-muted-foreground">{m.role}</span>
                    )}
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {new Date(m.joinedAt).toLocaleDateString()}
                  </td>
                  {isOwner ? (
                    <td className="p-4 text-right">
                      {m.role !== "owner" ? (
                        <button
                          type="button"
                          title={`Remove ${m.name}`}
                          onClick={() => setRemoveTarget({ id: m.id, name: m.name })}
                          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {isOwner ? (
          <>
            <section className="surface p-6">
              <h2 className="mb-4 text-3xl">Community settings</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Peer reviews</p>
                    <p className="text-xs text-muted-foreground">
                      Members review each other's videos after watching
                    </p>
                  </div>
                  <Switch
                    checked={settings.allowPeerReview}
                    onCheckedChange={(v) => handleSetting("allowPeerReview", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Collaboration</p>
                    <p className="text-xs text-muted-foreground">
                      Show this community's members as potential collaborators
                    </p>
                  </div>
                  <Switch
                    checked={settings.allowCollaboration}
                    onCheckedChange={(v) => handleSetting("allowCollaboration", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Approve public joins</p>
                    <p className="text-xs text-muted-foreground">
                      Creators who find this public community must request to join (invite-code
                      joins are always immediate)
                    </p>
                  </div>
                  <Switch
                    checked={settings.requireApproval}
                    onCheckedChange={(v) => handleSetting("requireApproval", v)}
                  />
                </div>
              </div>
            </section>

            <section className="surface p-6">
              <h2 className="mb-4 text-3xl">Invite & lifecycle</h2>
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">Invite code</p>
                    <p className="text-xs text-muted-foreground">
                      Regenerate if the current code leaked — the old code stops working immediately
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={regenerateInvite.isPending}
                    onClick={() =>
                      regenerateInvite.mutate(communityId, {
                        onSuccess: (res) => toast.success(`New invite code: ${res.inviteCode}`),
                        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
                      })
                    }
                  >
                    <RefreshCw className="size-4 mr-2" /> Regenerate code
                  </Button>
                </div>
                <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-destructive">Archive community</p>
                    <p className="text-xs text-muted-foreground">
                      Removes the community from all lists and queues. Videos are archived, members
                      are notified. History is kept for audits.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowArchiveDialog(true)}
                  >
                    Archive
                  </Button>
                </div>
              </div>
            </section>
          </>
        ) : null}

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

      {showLeaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="surface w-full max-w-md p-6">
            <h3 className="text-xl font-semibold">Leave {community.name}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You will stop receiving its queue items and reviews. You can rejoin later with an
              invite code.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLeaveDialog(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={() => void handleLeave()}
                disabled={leaveCommunity.isPending}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {leaveCommunity.isPending ? "Leaving..." : "Leave community"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showArchiveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="surface w-full max-w-md p-6">
            <h3 className="text-xl font-semibold text-destructive">Archive {community.name}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              The community disappears from every list, its videos leave the queue, and members are
              notified. This cannot be undone from the app.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowArchiveDialog(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleArchive()}
                disabled={archiveCommunity.isPending}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {archiveCommunity.isPending ? "Archiving..." : "Archive community"}
              </button>
            </div>
          </div>
        </div>
      )}

      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="surface w-full max-w-md p-6">
            <h3 className="text-xl font-semibold">Remove {removeTarget.name}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              They leave the community immediately and need a new invite to rejoin.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removeMember.isPending}
                onClick={() =>
                  removeMember.mutate(
                    { communityId, userId: removeTarget.id },
                    {
                      onSuccess: () => {
                        setRemoveTarget(null);
                        toast.success("Member removed");
                      },
                      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
                    },
                  )
                }
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {removeMember.isPending ? "Removing..." : "Remove member"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
