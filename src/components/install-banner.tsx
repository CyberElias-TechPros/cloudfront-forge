import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
      <Download className="size-5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Install LoopSquad</p>
        <p className="truncate text-xs text-muted-foreground">Full-screen app, faster loads</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          await deferredPrompt.prompt();
          const choice = await deferredPrompt.userChoice;
          if (choice.outcome === "accepted") setDeferredPrompt(null);
        }}
        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
      >
        Install
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
        aria-label="Dismiss install prompt"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
