import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, Flame, Lock, Pencil, Settings2, ShieldAlert, Youtube } from "lucide-react";
import { useState, useEffect } from "react";
import { PageHeader, Shell, StatCard } from "@/components/page-parts";
import {
  useMyProfile,
  useXp,
  useCredits,
  useStreaks,
  useBadges,
  useCurrentMember,
  useActivity,
  useYouTubeStatus,
  useConnectYouTube,
  useDisconnectYouTube,
  useMyReports,
  useAppealReport,
  useUpdateProfile,
} from "@/hooks/use-api";
import type { CreatorProfile, ProfileUpdateInput } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function ProfileEditDialog({
  displayName,
  profile,
  onClose,
}: {
  displayName: string;
  profile: CreatorProfile | null | undefined;
  onClose: () => void;
}) {
  const updateProfile = useUpdateProfile();
  const [form, setForm] = useState({
    displayName,
    bio: profile?.bio ?? "",
    niche: profile?.niche ?? "",
    country: profile?.country ?? "",
    experienceLevel: (profile?.experienceLevel ?? "") as
      "" | "beginner" | "intermediate" | "advanced",
    goals: profile?.goals ?? "",
    lookingFor: (profile?.lookingFor ?? "") as
      "" | "collaboration" | "feedback" | "support" | "mentorship",
  });

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = () => {
    if (!form.displayName.trim()) {
      toast.error("Display name is required");
      return;
    }
    const payload: ProfileUpdateInput = {
      displayName: form.displayName.trim(),
      bio: form.bio,
      niche: form.niche,
      country: form.country,
      goals: form.goals,
    };
    if (form.experienceLevel) payload.experienceLevel = form.experienceLevel;
    if (form.lookingFor) payload.lookingFor = form.lookingFor;

    updateProfile.mutate(payload, {
      onSuccess: () => {
        toast.success("Profile updated");
        onClose();
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Could not save your profile");
      },
    });
  };

  const fieldClass =
    "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="surface max-h-[85vh] w-full max-w-lg overflow-y-auto p-6">
        <h3 className="text-xl font-semibold">Edit profile</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          This is what other members see when they open your card. Visibility is controlled in
          Settings → General.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-muted-foreground">
            Display name
            <input
              value={form.displayName}
              onChange={(e) => set("displayName", e.target.value)}
              maxLength={50}
              className={fieldClass}
            />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Bio
            <textarea
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="What do you create, and what are you improving?"
              className={fieldClass}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-muted-foreground">
              Niche
              <input
                value={form.niche}
                onChange={(e) => set("niche", e.target.value)}
                maxLength={100}
                placeholder="Tech, fitness, vlogs…"
                className={fieldClass}
              />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Country
              <input
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
                maxLength={100}
                placeholder="Where you create"
                className={fieldClass}
              />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Experience
              <select
                value={form.experienceLevel}
                onChange={(e) => set("experienceLevel", e.target.value)}
                className={fieldClass}
              >
                <option value="">Prefer not to say</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Looking for
              <select
                value={form.lookingFor}
                onChange={(e) => set("lookingFor", e.target.value)}
                className={fieldClass}
              >
                <option value="">Nothing in particular</option>
                <option value="collaboration">Collaboration</option>
                <option value="feedback">Feedback</option>
                <option value="support">Support</option>
                <option value="mentorship">Mentorship</option>
              </select>
            </label>
          </div>
          <label className="block text-xs font-medium text-muted-foreground">
            Goals
            <textarea
              value={form.goals}
              onChange={(e) => set("goals", e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="What are you working towards this quarter?"
              className={fieldClass}
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={updateProfile.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {updateProfile.isPending ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile — LoopSquad" },
      {
        name: "description",
        content:
          "Track your level, trust score, badges, channel details and participation history in the squad.",
      },
      { property: "og:title", content: "Your Profile — LoopSquad" },
      {
        property: "og:description",
        content: "Level, trust score, badges and your full participation history.",
      },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { data: profile, isLoading: profileLoading, isError: profileError } = useMyProfile();
  const { data: xp, isLoading: xpLoading, isError: xpError } = useXp();
  const { data: credits, isLoading: creditsLoading, isError: creditsError } = useCredits();
  const { data: streaks, isLoading: streaksLoading, isError: streaksError } = useStreaks();
  const { data: badges = [], isLoading: badgesLoading, isError: badgesError } = useBadges();
  const { data: member, isLoading: memberLoading, isError: memberError } = useCurrentMember();
  const { data: activity = [], isLoading: activityLoading, isError: activityError } = useActivity();
  const { data: youtubeStatus, isLoading: ytLoading, isError: ytError } = useYouTubeStatus();
  const connectYouTube = useConnectYouTube();
  const disconnectYouTube = useDisconnectYouTube();

  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    if (connectYouTube.isSuccess) {
      toast.success("Opening YouTube authorization...");
    }
  }, [connectYouTube.isSuccess]);

  useEffect(() => {
    if (disconnectYouTube.isSuccess) {
      toast.success("YouTube account disconnected");
      setShowDisconnectDialog(false);
    }
  }, [disconnectYouTube.isSuccess]);

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

  const currentXP = xp?.totalXp ?? 0;
  const xpToNextLevel = xp?.xpToNextLevel ?? 250;
  const xpProgress = xp ? Math.max(0, Math.min(xpToNextLevel, currentXP)) : 0;
  const xpPct = xp ? Math.round((xpProgress / Math.max(xpToNextLevel, 1)) * 100) : null;
  const level = xp?.currentLevel ?? currentUser.level;
  const balance = credits?.balance ?? 0;
  const streak = streaks?.currentStreak ?? currentUser.streak;
  const displayName = profile?.displayName ?? currentUser.name;
  const photoUrl = profile?.photoUrl ?? null;
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : null;
  const loading =
    profileLoading ||
    xpLoading ||
    creditsLoading ||
    streaksLoading ||
    badgesLoading ||
    memberLoading ||
    activityLoading ||
    ytLoading;

  if (loading) {
    return (
      <Shell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading your profile...</p>
          </div>
        </div>
      </Shell>
    );
  }

  const error =
    profileError ||
    xpError ||
    creditsError ||
    streaksError ||
    badgesError ||
    memberError ||
    activityError ||
    ytError;
  if (error) {
    return (
      <Shell>
        <PageHeader eyebrow="" title="Your profile" description="" />
        <div className="mt-6 surface p-6 text-center text-destructive">
          <p className="text-sm">Failed to load profile data. Please try again later.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {(error as unknown as Error).message}
          </p>
        </div>
      </Shell>
    );
  }

  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const youtubeConnected = youtubeStatus?.connected ?? false;
  const youtubeChannelId = youtubeStatus?.channelId ?? null;

  return (
    <Shell>
      <PageHeader
        eyebrow={memberSince ? `Member since ${memberSince}` : ""}
        title="Your profile"
        description="Your trust score decides how much of the squad's attention you can receive each week."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowEditDialog(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Pencil className="size-4" /> Edit profile
            </button>
            <Link
              to="/settings"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium"
            >
              <Settings2 className="size-4" /> Settings
            </Link>
          </div>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="surface p-6">
          <div className="flex items-center gap-4">
            <span className="grid size-16 place-items-center overflow-hidden rounded-full bg-accent font-display text-3xl text-accent-foreground">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="size-full object-cover" />
              ) : (
                initials
              )}
            </span>
            <div>
              <h2 className="text-3xl leading-none">{displayName}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Youtube className="size-4 text-primary" /> {profile?.email ?? currentUser.handle}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm">
              <span>Level {level}</span>
              <span className="text-muted-foreground">
                {xpPct !== null ? `${xpPct}% to level ${level + 1}` : "Loading XP..."}
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${xpPct ?? 0}%` }}
              />
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            {[
              ["Rank", `#${currentUser.rank}`],
              ["Niche", profile?.profile?.niche || currentUser.niche],
              ["Subs given", String(currentUser.subsGiven)],
              ["Subs received", String(currentUser.subsReceived)],
              ["Watch minutes", String(currentUser.watchMinutes)],
              ["Streak", `${streak} days`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-secondary/60 p-3">
                <dt className="text-xs uppercase tracking-widest text-muted-foreground">{k}</dt>
                <dd className="mt-1 text-base font-medium">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 rounded-lg border border-border bg-secondary/40 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">About</h3>
              <button
                type="button"
                onClick={() => setShowEditDialog(true)}
                className="text-xs font-medium text-accent hover:underline"
              >
                {profile?.profile?.bio ? "Edit" : "Add bio"}
              </button>
            </div>
            {profile?.profile?.bio ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {profile.profile.bio}
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                No bio yet — members connect faster when they know what you create.
              </p>
            )}
            {profile?.profile?.goals ? (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Goals:</span> {profile.profile.goals}
              </p>
            ) : null}
            {profile?.profile?.lookingFor ? (
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Looking for:</span>{" "}
                {profile.profile.lookingFor}
              </p>
            ) : null}
          </div>
        </section>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Trust score"
              value={`${currentUser.trustScore}%`}
              hint="No flags in the last 60 days"
            />
            <StatCard
              label="Points balance"
              value={balance.toLocaleString()}
              hint="Spend on queue priority"
              icon={<Flame className="size-4" />}
            />
          </div>

          <section className="surface p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-3xl">
                <Youtube className="size-5 text-accent" /> YouTube
              </h2>
              {youtubeConnected ? (
                <button
                  type="button"
                  onClick={() => setShowDisconnectDialog(true)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => connectYouTube.mutate()}
                  disabled={connectYouTube.isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {connectYouTube.isPending ? "Connecting..." : "Connect YouTube"}
                </button>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {youtubeConnected
                ? `Connected${youtubeChannelId ? ` as ${youtubeChannelId}` : ""}. Subscription verification is active.`
                : "Connect your YouTube account to enable subscription verification and earn rewards."}
            </p>
          </section>

          <section className="surface p-6">
            <h2 className="flex items-center gap-2 text-3xl">
              <Award className="size-5 text-accent" /> Badges
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {badges.map((b) => (
                <div
                  key={b.name}
                  className={cn(
                    "rounded-lg border border-border p-4",
                    b.earned ? "bg-secondary/60" : "bg-card opacity-60",
                  )}
                >
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {b.earned ? (
                      <Award className="size-4 text-accent" />
                    ) : (
                      <Lock className="size-4 text-muted-foreground" />
                    )}
                    {b.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{b.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="surface p-6">
            <h2 className="text-3xl">History</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {activity.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span>
                    {a.who ? (
                      <>
                        <span className="font-medium">{a.who}</span>{" "}
                      </>
                    ) : null}
                    <span className="text-muted-foreground">{a.what}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{a.when}</span>
                </li>
              ))}
            </ul>
          </section>

          <ReportsAndAppeals />
        </div>
      </div>

      {showDisconnectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="surface max-w-md p-6">
            <h3 className="text-xl font-semibold">Disconnect YouTube?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This will stop subscription verification. You can reconnect anytime.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDisconnectDialog(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => disconnectYouTube.mutate()}
                disabled={disconnectYouTube.isPending}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {disconnectYouTube.isPending ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditDialog && (
        <ProfileEditDialog
          displayName={displayName}
          profile={profile?.profile ?? null}
          onClose={() => setShowEditDialog(false)}
        />
      )}
    </Shell>
  );
}

function ReportsAndAppeals() {
  const { data: reports = [], isLoading, isError } = useMyReports();
  const appealReport = useAppealReport();
  const [appealTarget, setAppealTarget] = useState<string | null>(null);
  const [appealText, setAppealText] = useState("");

  const statusLabel: Record<string, string> = {
    pending: "Under review",
    investigating: "Investigating",
    resolved: "Resolved",
    dismissed: "Dismissed",
  };

  const submitAppeal = async () => {
    if (!appealTarget) return;
    if (appealText.trim().length < 10) {
      toast.error("Please explain your appeal in at least 10 characters");
      return;
    }
    try {
      await appealReport.mutateAsync({ reportId: appealTarget, reason: appealText.trim() });
      toast.success("Appeal submitted — the moderation team will review it");
      setAppealTarget(null);
      setAppealText("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit the appeal");
    }
  };

  return (
    <section className="surface p-6">
      <h2 className="flex items-center gap-2 text-3xl">
        <ShieldAlert className="size-5 text-accent" /> Reports & appeals
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Reports filed against you appear here. If you believe one is mistaken, you can appeal it
        once — a moderator reviews the case and reverses the penalty if the appeal is accepted.
      </p>
      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : isError ? (
        <p className="mt-4 text-sm text-muted-foreground">Could not load your reports right now.</p>
      ) : reports.length === 0 ? (
        <p className="mt-4 text-sm text-success">No reports have been filed against you. 🎉</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium capitalize">
                  {r.reason} · {r.resourceType}
                </p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest",
                    r.status === "pending" || r.status === "investigating"
                      ? "bg-warning/15 text-warning"
                      : r.status === "resolved"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-success/15 text-success",
                  )}
                >
                  {statusLabel[r.status] ?? r.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Filed {new Date(r.createdAt).toLocaleString()}
                {r.resolutionNotes ? ` — ${r.resolutionNotes}` : ""}
              </p>
              {r.status === "pending" && !r.appealed ? (
                <button
                  type="button"
                  onClick={() => {
                    setAppealTarget(r.id);
                    setAppealText("");
                  }}
                  className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                >
                  Appeal this report
                </button>
              ) : r.appealed ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Appeal submitted — pending review.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {appealTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="surface w-full max-w-md p-6">
            <h3 className="text-xl font-semibold">Appeal this report</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Explain why the report is mistaken. You can appeal once per report.
            </p>
            <textarea
              value={appealText}
              onChange={(e) => setAppealText(e.target.value)}
              rows={5}
              maxLength={2000}
              className="mt-3 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
              placeholder="What actually happened?"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAppealTarget(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitAppeal()}
                disabled={appealReport.isPending || appealText.trim().length < 10}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {appealReport.isPending ? "Submitting..." : "Submit appeal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
