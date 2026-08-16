import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Copy,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Users,
  UserPlus,
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, Shell, StatCard, Thumb } from "@/components/page-parts";
import {
  useCommunities,
  useCreateCommunity,
  useJoinCommunity,
  useCurrentMember,
} from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/communities")({
  head: () => ({
    meta: [
      { title: "Communities — LoopSquad" },
      {
        name: "description",
        content: "Join or create communities to grow your channel alongside trusted creators.",
      },
      { property: "og:title", content: "Communities — LoopSquad" },
      {
        property: "og:description",
        content: "Creator communities built for fair, verified growth.",
      },
    ],
  }),
  component: Communities,
});

function Communities() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState("25");

  const { data: communities, isLoading, isError, error } = useCommunities();
  const createCommunity = useCreateCommunity();
  const joinCommunity = useJoinCommunity();
  const { data: member } = useCurrentMember();

  const currentUser = member ?? {
    id: "",
    name: "Creator",
    handle: "@creator",
    avatar: "C",
    points: 0,
    streak: 0,
    level: 1,
    rank: 0,
    niche: "Creator",
    subsGiven: 0,
    subsReceived: 1,
    watchMinutes: 0,
    trustScore: 0,
  };

  const filtered = (communities ?? []).filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    try {
      const result = await joinCommunity.mutateAsync(inviteCode.trim());
      toast.success(`Joined ${result.communityName ?? "community"}!`);
      setInviteOpen(false);
      setInviteCode("");
    } catch (error) {
      console.error("Join error:", error);
      toast.error("Could not join community. Check the code and try again.");
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const input: { name: string; description?: string; maxMembers?: number } = {
        name: name.trim(),
        maxMembers: Math.max(5, Number(maxMembers) || 25),
      };
      if (description.trim()) input.description = description.trim();
      const result = await createCommunity.mutateAsync(input);
      toast.success(`Community created! Invite code: ${result.inviteCode}`);
      setCreateOpen(false);
      setName("");
      setDescription("");
      setMaxMembers("25");
    } catch (error) {
      console.error("Create error:", error);
      toast.error("Could not create community.");
    }
  };

  const copyInvite = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success("Invite code copied to clipboard");
  };

  return (
    <Shell>
      <PageHeader
        eyebrow="Creator circles"
        title="Communities"
        description="Join a private circle of creators in your niche, or start your own."
        action={
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search communities..."
                className="pl-10 w-56"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <UserPlus className="size-4 mr-2" />
                  Join with code
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Join a community</DialogTitle>
                  <DialogDescription>
                    Enter an invite code to join a private community.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="invite-code" className="mb-2 block">
                    Invite code
                  </Label>
                  <Input
                    id="invite-code"
                    placeholder="e.g. NAIJA2026"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button variant="ghost" size="sm" onClick={() => setInviteOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleJoin}
                    disabled={!inviteCode || joinCommunity.isPending}
                  >
                    {joinCommunity.isPending ? "Joining..." : "Join community"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4 mr-2" />
                  Create community
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create a new community</DialogTitle>
                  <DialogDescription>
                    Start a private circle for creators in your niche.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div>
                    <Label htmlFor="name" className="mb-1 block">
                      Community name
                    </Label>
                    <Input
                      id="name"
                      placeholder="e.g. Naija Creators"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="description" className="mb-1 block">
                      Description (optional)
                    </Label>
                    <Input
                      id="description"
                      placeholder="What is this community about?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="max-members" className="mb-1 block">
                      Max members
                    </Label>
                    <Input
                      id="max-members"
                      type="number"
                      value={maxMembers}
                      onChange={(e) => setMaxMembers(e.target.value)}
                      min="5"
                      max="100"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreate}
                    disabled={!name || createCommunity.isPending}
                  >
                    {createCommunity.isPending ? "Creating..." : "Create community"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Communities"
          value={(communities?.length ?? 0).toString()}
          hint="Total circles"
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Total members"
          value={(communities ?? []).reduce((a, c) => a + (c.memberCount ?? 0), 0).toString()}
          hint="Across all circles"
          icon={<UserPlus className="size-4" />}
        />
        <StatCard
          label="Your trust score"
          value={`${currentUser.trustScore}%`}
          hint="No flags recently"
          icon={<Shield className="size-4" />}
        />
      </div>

      <div className="mt-6 space-y-4">
        {isLoading ? (
          <div className="surface flex items-center justify-center py-12 text-sm text-muted-foreground">
            Loading communities...
          </div>
        ) : isError ? (
          <div className="surface p-6 text-center text-destructive">
            <p className="text-sm">Failed to load communities. Please try again later.</p>
            <p className="mt-1 text-xs text-muted-foreground">{(error as Error).message}</p>
          </div>
        ) : null}
        {!isLoading && filtered.length === 0 ? (
          <div className="surface py-12 text-center">
            <Users className="mx-auto size-12 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              No communities found. Create one to get started.
            </p>
          </div>
        ) : null}
        {filtered.map((community) => (
          <article key={community.id} className="surface p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-28 shrink-0">
                  <Thumb hue={community.thumbHue} label={community.niche} />
                </div>
                <div>
                  <h3 className="text-2xl font-medium">{community.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{community.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="size-3.5" />
                      {community.memberCount}/{community.maxMembers} members
                    </span>
                    <span className="flex items-center gap-1">
                      {community.isPublic ? (
                        <ShieldCheck className="size-3.5 text-success" />
                      ) : (
                        <Shield className="size-3.5" />
                      )}
                      {community.isPublic ? "Public" : "Private"}
                    </span>
                    {community.isOwner ? (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest">
                        You own this
                      </span>
                    ) : null}
                    <span>{community.updatedAt}</span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {community.isOwner ? (
                  <Link
                    to="/communities/$communityId"
                    params={{ communityId: community.id }}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    Manage
                  </Link>
                ) : (
                  <Link
                    to="/communities/$communityId"
                    params={{ communityId: community.id }}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium"
                  >
                    View
                  </Link>
                )}
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="size-4" />
                </Button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="size-3.5" />
                {community.memberCount ?? 0} members
              </span>
              {community.isOwner && community.inviteCode ? (
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium"
                  onClick={() => copyInvite(community.inviteCode ?? "")}
                >
                  <Copy className="size-3" /> Invite: {community.inviteCode}
                </button>
              ) : null}
              <Link
                to="/communities/$communityId"
                params={{ communityId: community.id }}
                className="text-accent hover:underline"
              >
                View member directory
              </Link>
            </div>
          </article>
        ))}
      </div>
    </Shell>
  );
}
