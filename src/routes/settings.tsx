import { createFileRoute } from "@tanstack/react-router";
import { Youtube, Settings2, Bell, Shield, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, Shell } from "@/components/page-parts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  useYouTubeStatus,
  useConnectYouTube,
  useDisconnectYouTube,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useDeleteAccount,
} from "@/hooks/use-api";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { usePushSubscription } from "@/hooks/use-push";

export const Route = createFileRoute("/settings")({
  validateSearch: (search: Record<string, unknown>): { youtube?: string; reason?: string } => {
    const out: { youtube?: string; reason?: string } = {};
    if (typeof search["youtube"] === "string") out["youtube"] = search["youtube"];
    if (typeof search["reason"] === "string") out["reason"] = search["reason"];
    return out;
  },
  head: () => ({
    meta: [
      { title: "Settings — LoopSquad" },
      {
        name: "description",
        content: "Manage your YouTube connection and notification preferences.",
      },
    ],
  }),
  component: Settings,
});

function Settings() {
  const {
    data: youtubeStatus,
    refetch: refetchYoutubeStatus,
    isError: youtubeStatusError,
  } = useYouTubeStatus();
  const connectYouTube = useConnectYouTube();
  const disconnectYouTube = useDisconnectYouTube();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const push = usePushSubscription();
  const { data: preferences } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const deleteAccount = useDeleteAccount();
  const { signOut } = useAuth();

  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [localPrefs, setLocalPrefs] = useState({
    emailEnabled: true,
    pushEnabled: true,
    inAppEnabled: true,
    missionReminders: true,
    reviewRequests: true,
    communityUpdates: true,
    quietHoursStart: null as number | null,
    quietHoursEnd: null as number | null,
  });

  useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences);
    }
  }, [preferences]);

  // Handle OAuth redirect back from Google (worker redirects here with ?youtube=connected|error)
  useEffect(() => {
    if (!search.youtube) return;
    if (search.youtube === "connected") {
      toast.success("YouTube account connected — subscription verification is now active");
      void queryClient.invalidateQueries({ queryKey: ["youtube", "status"] });
      void refetchYoutubeStatus();
    } else if (search.youtube === "error") {
      toast.error(
        `YouTube connection failed${search.reason ? `: ${decodeURIComponent(search.reason)}` : ""}`,
      );
    }
    void navigate({ search: {}, replace: true });
  }, [search.youtube, search.reason, navigate, queryClient, refetchYoutubeStatus]);

  const handlePreferenceChange = (key: string, value: boolean | number | null) => {
    setLocalPrefs((prev) => ({ ...prev, [key]: value }));
    updatePreferences.mutate({ [key]: value });
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount.mutateAsync();
      setShowDeleteDialog(false);
      toast.success("Your account has been deleted");
      await signOut();
      navigate({ to: "/" });
    } catch (error) {
      console.error("Delete account error:", error);
      toast.error(
        error instanceof Error ? error.message : "Could not delete your account. Try again.",
      );
    }
  };

  const youtubeConnected = youtubeStatus?.connected ?? false;
  const youtubeUnreachable = youtubeStatusError && !youtubeStatus;
  const youtubeChannelId = youtubeStatus?.channelId ?? null;

  return (
    <Shell>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Manage your account, connections and notifications."
        action={
          <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground">
            <Settings2 className="size-4" /> Settings
          </span>
        }
      />

      <div className="mt-6 grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Youtube className="size-5 text-accent" /> YouTube Connection
            </CardTitle>
            <CardDescription>
              Connect your YouTube account to enable subscription verification and earn rewards.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {youtubeConnected
                    ? `Connected${youtubeChannelId ? ` as ${String(youtubeChannelId).slice(0, 14)}…` : ""}`
                    : "Not connected"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {youtubeUnreachable
                    ? "Connection status unavailable — check your connection and retry."
                    : youtubeConnected
                      ? "Subscription verification is active."
                      : "Connect your YouTube account to enable subscription verification."}
                </p>
                {youtubeUnreachable ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => void refetchYoutubeStatus()}
                  >
                    Retry
                  </Button>
                ) : null}
              </div>
              {youtubeConnected ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDisconnectDialog(true)}
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => connectYouTube.mutate()}
                  disabled={connectYouTube.isPending}
                >
                  {connectYouTube.isPending ? "Connecting..." : "Connect YouTube"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-5 text-accent" /> Notifications
            </CardTitle>
            <CardDescription>Choose how you want to be notified about activity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email notifications</p>
                <p className="text-xs text-muted-foreground">Receive updates via email</p>
              </div>
              <Switch
                checked={localPrefs.emailEnabled}
                onCheckedChange={(checked) => handlePreferenceChange("emailEnabled", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Push notifications</p>
                <p className="text-xs text-muted-foreground">Receive push notifications</p>
              </div>
              <Switch
                checked={localPrefs.pushEnabled}
                onCheckedChange={(checked) => handlePreferenceChange("pushEnabled", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">In-app notifications</p>
                <p className="text-xs text-muted-foreground">Show notifications in the app</p>
              </div>
              <Switch
                checked={localPrefs.inAppEnabled}
                onCheckedChange={(checked) => handlePreferenceChange("inAppEnabled", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Mission reminders</p>
                <p className="text-xs text-muted-foreground">
                  Get reminded about mission deadlines
                </p>
              </div>
              <Switch
                checked={localPrefs.missionReminders}
                onCheckedChange={(checked) => handlePreferenceChange("missionReminders", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Review requests</p>
                <p className="text-xs text-muted-foreground">
                  Get notified when a review is assigned
                </p>
              </div>
              <Switch
                checked={localPrefs.reviewRequests}
                onCheckedChange={(checked) => handlePreferenceChange("reviewRequests", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Community updates</p>
                <p className="text-xs text-muted-foreground">
                  Get notified about new videos in communities
                </p>
              </div>
              <Switch
                checked={localPrefs.communityUpdates}
                onCheckedChange={(checked) => handlePreferenceChange("communityUpdates", checked)}
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-sm font-medium">Quiet hours (UTC)</p>
              <p className="text-xs text-muted-foreground">
                Pause push notifications during these hours
              </p>
              <div className="flex items-center gap-3">
                <label className="text-xs text-muted-foreground">From</label>
                <select
                  value={localPrefs.quietHoursStart ?? ""}
                  onChange={(e) =>
                    handlePreferenceChange(
                      "quietHoursStart",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                  className="rounded-md border border-border bg-card px-2 py-1 text-xs"
                >
                  <option value="">Off</option>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
                <label className="text-xs text-muted-foreground">to</label>
                <select
                  value={localPrefs.quietHoursEnd ?? ""}
                  onChange={(e) =>
                    handlePreferenceChange(
                      "quietHoursEnd",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                  className="rounded-md border border-border bg-card px-2 py-1 text-xs"
                >
                  <option value="">Off</option>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {push.supported && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Push notifications</p>
                  <p className="text-xs text-muted-foreground">
                    {push.subscribed
                      ? "Receiving browser push notifications"
                      : "Enable browser push notifications on this device"}
                  </p>
                </div>
                <Button
                  variant={push.subscribed ? "destructive" : "default"}
                  size="sm"
                  onClick={push.subscribed ? push.unsubscribe : push.subscribe}
                  disabled={push.loading}
                >
                  {push.loading ? "..." : push.subscribed ? "Unsubscribe" : "Subscribe"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-5 text-accent" /> General
            </CardTitle>
            <CardDescription>Account and display preferences.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Dark mode</p>
                <p className="text-xs text-muted-foreground">Use dark theme across the app</p>
              </div>
              <Switch
                checked={true}
                onCheckedChange={() => toast.info("Dark mode setting coming soon")}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Public profile</p>
                <p className="text-xs text-muted-foreground">Allow others to see your profile</p>
              </div>
              <Switch
                checked={true}
                onCheckedChange={() => toast.info("Public profile setting coming soon")}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" /> Danger zone
            </CardTitle>
            <CardDescription>
              Permanently close your account. Your videos leave the queue, your community
              memberships end, and you can no longer sign in with this Google account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Your watch history and reward ledger are kept for audit purposes, but your name is
                removed from leaderboards, discovery and every member list.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setDeleteConfirmText("");
                  setShowDeleteDialog(true);
                }}
              >
                Delete my account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="surface w-full max-w-md p-6">
            <h3 className="text-xl font-semibold text-destructive">Delete your account?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This closes your account immediately: you leave every community, your videos are
              removed from the queue, and pending top-ups and requests are cancelled. This cannot be
              undone.
            </p>
            <label className="mt-4 block text-xs font-medium text-muted-foreground">
              Type <span className="font-mono text-foreground">DELETE</span> to confirm
            </label>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="mt-2 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteAccount()}
                disabled={deleteConfirmText !== "DELETE" || deleteAccount.isPending}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleteAccount.isPending ? "Deleting..." : "Permanently delete"}
              </button>
            </div>
          </div>
        </div>
      )}

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
    </Shell>
  );
}
