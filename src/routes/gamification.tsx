import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Award,
  Banknote,
  Calendar,
  Check,
  Clock,
  Copy,
  Flame,
  Gift,
  ImagePlus,
  Rocket,
  Snowflake,
  Star,
  Trophy,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { PageHeader, Shell, StatCard } from "@/components/page-parts";
import {
  useCredits,
  useStreaks,
  useXp,
  useLeaderboard,
  useBadges,
  useSubmissions,
  useActivity,
  usePurchase,
  useCurrentMember,
  useDailyBonus,
  useTopupCatalog,
  useMyTopups,
  useRequestTopup,
  useUploadTopupProof,
} from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/gamification")({
  head: () => ({
    meta: [
      { title: "Gamification — LoopSquad" },
      {
        name: "description",
        content: "Track your XP, credits, streak, badges, and upcoming rewards.",
      },
      { property: "og:title", content: "Gamification — LoopSquad" },
      {
        property: "og:description",
        content: "Level up your creator journey with points, streaks and badges.",
      },
    ],
  }),
  component: Gamification,
});

const xpLevels = [0, 100, 250, 500, 1000, 1800, 3000, 5000, 8000, 12000, 18000];

function Gamification() {
  const { data: xp, isLoading: xpLoading, isError: xpError } = useXp();
  const { data: credits, isLoading: creditsLoading, isError: creditsError } = useCredits();
  const { data: submissions = [] } = useSubmissions();
  const purchase = usePurchase();
  const dailyBonus = useDailyBonus();
  const activeVideos = submissions.filter((s) => s.status === "active");
  const { data: streaks, isLoading: streaksLoading, isError: streaksError } = useStreaks();
  const { data: leaderboard = [], isLoading: lbLoading, isError: lbError } = useLeaderboard();
  const { data: badges = [], isLoading: badgesLoading, isError: badgesError } = useBadges();
  const { data: member, isLoading: memberLoading, isError: memberError } = useCurrentMember();
  const { data: activity = [], isLoading: activityLoading, isError: activityError } = useActivity();

  const loading =
    xpLoading ||
    creditsLoading ||
    streaksLoading ||
    lbLoading ||
    badgesLoading ||
    memberLoading ||
    activityLoading;

  if (loading) {
    return (
      <Shell>
        <PageHeader eyebrow="" title="Gamification" description="" />
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading gamification data...</p>
          </div>
        </div>
      </Shell>
    );
  }

  const error =
    xpError ||
    creditsError ||
    streaksError ||
    lbError ||
    badgesError ||
    memberError ||
    activityError;
  if (error) {
    return (
      <Shell>
        <PageHeader eyebrow="" title="Gamification" description="" />
        <div className="mt-6 surface p-6 text-center text-destructive">
          <p className="text-sm">Failed to load gamification data. Please try again later.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {(error as unknown as Error).message}
          </p>
        </div>
      </Shell>
    );
  }

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

  const currentXP = xp?.totalXp ?? currentUser.points;
  const currentLevel = xp?.currentLevel ?? currentUser.level;
  const xpForCurrentLevel = xpLevels[currentLevel - 1] ?? 0;
  const xpForNextLevel = xpLevels[currentLevel] ?? xpLevels[xpLevels.length - 1]!;
  const xpToNextLevel = xp?.xpToNextLevel ?? xpForNextLevel - xpForCurrentLevel;
  const xpProgress = Math.max(0, Math.min(xpToNextLevel, currentXP - xpForCurrentLevel));
  const xpPct = Math.round((xpProgress / xpToNextLevel) * 100);
  const creditBalance = credits?.balance ?? 0;
  const streak = streaks?.currentStreak ?? currentUser.streak;
  const topMembers = leaderboard.length
    ? leaderboard
    : ([] as { id: string; displayName: string; totalXp: number; reputation: number }[]);

  return (
    <Shell>
      <PageHeader
        eyebrow={`Level ${currentLevel} · ${currentUser.niche}`}
        title="Gamification"
        description="Your XP, credits, streak, and rewards all in one place."
        action={
          <Button
            size="sm"
            disabled={dailyBonus.isPending}
            onClick={() =>
              dailyBonus.mutate(undefined, {
                onSuccess: (data) =>
                  toast.success(
                    `+${data.credits} credits claimed! (${data.multiplier}× streak multiplier)`,
                  ),
                onError: (err: unknown) =>
                  toast.error(
                    (err instanceof Error ? err.message : String(err)).includes("409")
                      ? "Already claimed today"
                      : "Failed to claim bonus",
                  ),
              })
            }
          >
            <Gift className="size-4 mr-2" />
            {dailyBonus.isPending ? "Claiming..." : "Claim daily bonus"}
          </Button>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total XP"
          value={currentXP.toLocaleString()}
          hint={`Level ${currentLevel}`}
          icon={<Trophy className="size-4" />}
        />
        <StatCard
          label="Credit balance"
          value={creditBalance.toString()}
          hint="Spend on queue priority"
          icon={<Zap className="size-4" />}
        />
        <StatCard
          label="Current streak"
          value={`${streak} days`}
          hint="Last active today"
          icon={<Flame className="size-4" />}
        />
        <StatCard
          label="Trust score"
          value={`${currentUser.trustScore}%`}
          hint="Top 10% of squad"
          icon={<Star className="size-4" />}
        />
      </div>

      <div className="mt-6 space-y-6 lg:grid lg:grid-cols-[2fr_1fr] lg:gap-6 lg:space-y-0">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Level progress</CardTitle>
              <CardDescription>
                {xpPct}% to level {currentLevel + 1} · {xpToNextLevel - xpProgress} XP remaining
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-4 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-accent transition-all" style={{ width: `${xpPct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    Level {currentLevel} ({xpForCurrentLevel.toLocaleString()} XP)
                  </span>
                  <span>
                    Level {currentLevel + 1} ({xpForNextLevel.toLocaleString()} XP)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Badges</CardTitle>
              <CardDescription>
                {badges.filter((b) => b.earned).length} of {badges.length} earned
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {badges.map((b) => (
                  <div
                    key={b.name}
                    className={cn(
                      "rounded-lg border border-border p-4",
                      b.earned ? "bg-secondary/60" : "bg-card opacity-50",
                    )}
                  >
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      {b.earned ? (
                        <Award className="size-4 text-accent" />
                      ) : (
                        <Award className="size-4 text-muted-foreground" />
                      )}
                      {b.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{b.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>XP history</CardTitle>
              <CardDescription>Recent rewards and penalties</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activity.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      {a.who ? (
                        <>
                          <span className="font-medium">{a.who}</span>{" "}
                        </>
                      ) : null}
                      <span className="text-muted-foreground">{a.what}</span>
                      <span className="block text-xs text-muted-foreground">{a.when}</span>
                    </div>
                    {a.points ? (
                      <span
                        className={cn(
                          "text-sm font-medium",
                          a.points.startsWith("-") ? "text-destructive" : "text-success",
                        )}
                      >
                        {a.points}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Credit shop</CardTitle>
              <CardDescription>Spend credits on boosts and streak protection</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <ShopItem
                  name="Video boost"
                  description="Top of the queue for 24h"
                  cost={50}
                  icon={<Rocket className="size-4 text-accent" />}
                  disabled={creditBalance < 50 || activeVideos.length === 0}
                  busy={purchase.isPending}
                  onPurchase={() => {
                    const video = activeVideos[0];
                    if (!video) return;
                    purchase.mutate(
                      { itemType: "boost", videoId: video.id },
                      {
                        onSuccess: (res) =>
                          toast.success(
                            `"${video.title}" boosted for 24h. Balance: ${res.balance} credits`,
                          ),
                        onError: (e: Error) => toast.error(e.message),
                      },
                    );
                  }}
                />
                <ShopItem
                  name="Streak freeze"
                  description="Protects streak one inactive day"
                  cost={30}
                  icon={<Snowflake className="size-4 text-accent" />}
                  disabled={creditBalance < 30}
                  busy={purchase.isPending}
                  onPurchase={() => {
                    purchase.mutate(
                      { itemType: "streak_freeze" },
                      {
                        onSuccess: (res) =>
                          toast.success(`Streak freeze acquired. Balance: ${res.balance} credits`),
                        onError: (e: Error) => toast.error(e.message),
                      },
                    );
                  }}
                />
                {activeVideos.length > 1 && activeVideos[0] && (
                  <p className="text-xs text-muted-foreground">
                    Boost applies to your most recent active video: "{activeVideos[0].title}"
                  </p>
                )}
                {activeVideos.length === 0 && (
                  <p className="text-xs text-muted-foreground">Submit a video to unlock boosts.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <BuyCreditsCard />

          <Card>
            <CardHeader>
              <CardTitle>Squad ranking</CardTitle>
              <CardDescription>Your position among members</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topMembers.slice(0, 5).map((m, i) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg p-2",
                      i === 0 && "bg-secondary/60",
                    )}
                  >
                    <span className="text-xs font-display text-muted-foreground w-5">#{i + 1}</span>
                    <span className="grid size-7 place-items-center rounded-full bg-secondary text-xs font-semibold">
                      {m.displayName?.[0] ?? "?"}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{m.displayName}</p>
                      <p className="text-xs text-muted-foreground">{m.reputation}% trust</p>
                    </div>
                    <span className="text-sm font-medium text-accent">{m.totalXp} XP</span>
                  </div>
                ))}
                {topMembers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No leaderboard data yet.
                  </p>
                ) : null}
              </div>
              <Button variant="ghost" size="sm" className="mt-3 w-full" asChild>
                <Link to="/leaderboard">View full leaderboard</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming rewards</CardTitle>
              <CardDescription>
                <Calendar className="size-3.5 inline mr-1" />
                Next reset in 4h 12m
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-secondary/60 p-3">
                  <div>
                    <p className="text-sm font-medium">7-day streak bonus</p>
                    <p className="text-xs text-muted-foreground">+50 XP bonus</p>
                  </div>
                  <Flame className="size-5 text-warning" />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-secondary/60 p-3">
                  <div>
                    <p className="text-sm font-medium">100 subscribers given</p>
                    <p className="text-xs text-muted-foreground">+100 credit reward</p>
                  </div>
                  <Trophy className="size-5 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

const ACCEPTED_PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PROOF_BYTES = 5 * 1024 * 1024; // match backend limit

function BuyCreditsCard() {
  const { data: catalog, isLoading: catalogLoading } = useTopupCatalog();
  const { data: mine = [] } = useMyTopups();
  const requestTopup = useRequestTopup();
  const uploadProof = useUploadTopupProof();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tierId, setTierId] = useState<string>("starter");
  const [reference, setReference] = useState("");
  const [copied, setCopied] = useState(false);
  // Uploaded proof: server path + local preview (revoked on change/unmount).
  const [proofImage, setProofImage] = useState<string>("");
  const [proofName, setProofName] = useState<string>("");
  const [proofType, setProofType] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");

  if (!catalog) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Buy credits</CardTitle>
          <CardDescription>Top up with naira via bank transfer</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {catalogLoading
              ? "Loading top-up options…"
              : "Top-ups are not available right now. Please try again later."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const bank = catalog.bank;
  const selected = catalog.tiers.find((t) => t.id === tierId) ?? catalog.tiers[0];
  const hasPending = catalog.pending || mine.some((t) => t.status === "pending");
  const hasProof = proofImage.length > 0;
  const canSubmit = hasProof || reference.trim().length >= 4;

  const clearProof = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setProofImage("");
    setProofName("");
    setProofType("");
    setPreviewUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText(bank.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — the number stays on
      // screen for manual copying.
    }
  };

  const onFileSelected = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_PROOF_TYPES.includes(file.type)) {
      toast.error("Upload a JPEG, PNG or WebP screenshot of the transfer.");
      return;
    }
    if (file.size > MAX_PROOF_BYTES) {
      toast.error("Proof image must be 5MB or smaller.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setProofName(file.name);
    setProofType(file.type);
    setReference("");
    uploadProof.mutate(file, {
      onSuccess: (res) => {
        setProofImage(res.path);
        toast.success("Proof uploaded — you can now submit your top-up.");
      },
      onError: (e: Error) => {
        clearProof();
        toast.error(e.message);
      },
    });
  };

  const submit = () => {
    if (!selected) return;
    const payload: {
      tierId: string;
      proofImage?: string;
      proofImageName?: string;
      proofImageType?: string;
      transferReference?: string;
    } = { tierId: selected.id };
    if (hasProof) {
      payload.proofImage = proofImage;
      payload.proofImageName = proofName;
      payload.proofImageType = proofType;
    }
    const ref = reference.trim();
    if (ref.length >= 4) payload.transferReference = ref;
    requestTopup.mutate(payload, {
      onSuccess: () => {
        clearProof();
        setReference("");
        toast.success("Transfer submitted! We'll verify it and credit your points shortly.");
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buy credits</CardTitle>
        <CardDescription>Top up with naira via bank transfer</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid gap-2">
            {catalog.tiers.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTierId(t.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors",
                  t.id === tierId
                    ? "border-accent bg-secondary/60"
                    : "border-border hover:bg-secondary/30",
                )}
              >
                <span>
                  <span className="block text-sm font-medium">
                    {t.name} — ₦{t.ngn.toLocaleString()}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t.credits} credits{t.bonus > 0 ? ` (incl. ${t.bonus} bonus)` : ""}
                  </span>
                </span>
                <Banknote
                  className={cn(
                    "size-4",
                    t.id === tierId ? "text-accent" : "text-muted-foreground",
                  )}
                />
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Transfer to
            </p>
            <p className="mt-2 font-medium">{bank.accountName}</p>
            <p className="text-muted-foreground">{bank.bankName}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-lg font-semibold tabular-nums tracking-wide">
                {bank.accountNumber}
              </span>
              <Button variant="ghost" size="sm" onClick={() => void copyAccount()}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            {selected && (
              <p className="mt-2 text-xs text-muted-foreground">
                Send exactly{" "}
                <span className="font-medium text-foreground">
                  ₦{selected.ngn.toLocaleString()}
                </span>{" "}
                then screenshot the confirmation page.
              </p>
            )}
          </div>

          {hasPending ? (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
              <p className="flex items-center gap-2 text-xs font-medium">
                <Clock className="size-4 text-warning" /> Awaiting verification
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your proof of payment is under review. Credits are added as soon as an admin
                confirms the transfer.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => onFileSelected(e.target.files?.[0])}
              />
              {hasProof ? (
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="relative">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Transfer receipt"
                        className="max-h-48 w-full object-contain bg-black/5"
                      />
                    ) : (
                      <div className="grid h-28 place-items-center text-muted-foreground">
                        <Upload className="size-5 animate-pulse" />
                      </div>
                    )}
                    <button
                      type="button"
                      aria-label="Remove proof"
                      onClick={clearProof}
                      className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-card text-muted-foreground shadow hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <p className="truncate border-t border-border/60 bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground">
                    {proofName}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-5 text-muted-foreground transition-colors hover:border-accent hover:bg-secondary/30"
                >
                  {uploadProof.isPending ? (
                    <Upload className="size-5 animate-pulse" />
                  ) : (
                    <ImagePlus className="size-5" />
                  )}
                  <span className="text-xs font-medium">
                    {uploadProof.isPending
                      ? "Uploading proof…"
                      : "Tap to upload your transfer receipt"}
                  </span>
                  <span className="text-[10px]">JPEG, PNG or WebP · up to 5MB</span>
                </button>
              )}
              <p className="text-[10px] text-muted-foreground">
                Need the reference too?{" "}
                <span className="text-foreground">Only if your bank shows one.</span>
              </p>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Transfer reference (optional)"
                className="font-mono text-xs"
              />
              <Button
                size="sm"
                className="w-full"
                disabled={!canSubmit || requestTopup.isPending}
                onClick={submit}
              >
                <Banknote className="size-4 mr-2" />
                {requestTopup.isPending
                  ? "Submitting…"
                  : hasProof
                    ? "I've transferred — submit proof"
                    : "I've transferred — submit reference"}
              </Button>
            </div>
          )}

          {mine.length > 0 && (
            <div className="space-y-2 border-t border-border/60 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                My top-ups
              </p>
              {mine.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-xs">
                  <span className="truncate font-mono text-muted-foreground">
                    {t.proof_image_name ??
                      (t.transfer_reference.startsWith("proof:")
                        ? "Proof of payment"
                        : t.transfer_reference)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest",
                      t.status === "approved"
                        ? "bg-success/15 text-success"
                        : t.status === "pending"
                          ? "bg-warning/15 text-warning"
                          : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Payments are verified manually — credits are usually added within 24 hours of approval.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ShopItem({
  name,
  description,
  cost,
  icon,
  disabled,
  busy,
  onPurchase,
}: {
  name: string;
  description: string;
  cost: number;
  icon: React.ReactNode;
  disabled?: boolean;
  busy?: boolean;
  onPurchase: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onPurchase} disabled={disabled || busy}>
        <Zap className="size-4 mr-1" />
        {cost}
      </Button>
    </div>
  );
}
