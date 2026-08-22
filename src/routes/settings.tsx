import { createFileRoute } from "@tanstack/react-router";
import { Youtube, Settings2, Bell, Shield } from "lucide-react";
import { useState, useEffect } from "react";
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
} from "@/hooks/use-api";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
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
  const { data: youtubeStatus } = useYouTubeStatus();
  const connectYouTube = useConnectYouTube();
  const disconnectYouTube = useDisconnectYouTube();
  const { data: preferences } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();

  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [localPrefs, setLocalPrefs] = useState({
    emailEnabled: true,
    pushEnabled: true,
    inAppEnabled: true,
    missionReminders: true,
    reviewRequests: true,
    communityUpdates: true,
  });

  useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences);
    }
  }, [preferences]);

  const handlePreferenceChange = (key: string, value: boolean) => {
    setLocalPrefs((prev) => ({ ...prev, [key]: value }));
    updatePreferences.mutate({ [key]: value });
  };

  const youtubeConnected = youtubeStatus?.connected ?? false;
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
                    ? `Connected${youtubeChannelId ? ` as ${youtubeChannelId}` : ""}`
                    : "Not connected"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {youtubeConnected
                    ? "Subscription verification is active."
                    : "Connect your YouTube account to enable subscription verification."}
                </p>
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
              <Switch checked={true} onCheckedChange={() => toast.info("Dark mode setting coming soon")} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Public profile</p>
                <p className="text-xs text-muted-foreground">Allow others to see your profile</p>
              </div>
              <Switch checked={true} onCheckedChange={() => toast.info("Public profile setting coming soon")} />
            </div>
          </CardContent>
        </Card>
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
    </Shell>
  );
}
