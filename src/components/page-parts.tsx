import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
        ) : null}
        <h1 className="mt-2 text-4xl sm:text-5xl">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Shell({ children, className }: { children: ReactNode; className?: string }) {
  const { accountError, signOut } = useAuth();

  // A suspended/banned/deleted account may not reach any app data — show the
  // reason and a way out instead of a wall of failed requests.
  if (accountError) {
    return (
      <main className={cn("mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10", className)}>
        <div className="mx-auto max-w-md py-16 text-center">
          <ShieldAlert className="mx-auto size-12 text-warning" />
          <h1 className="mt-4 text-3xl font-semibold">Account unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">{accountError}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            If you believe this is a mistake, sign out and reach out through the support page.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-6 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={cn("mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10", className)}>
      {children}
    </main>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        {icon ? <span className="text-accent">{icon}</span> : null}
      </div>
      <p className="mt-3 font-display text-4xl leading-none">{value}</p>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Thumb({ hue, label }: { hue: number; label: string }) {
  return (
    <div
      className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-lg border border-border"
      style={{
        backgroundImage: `linear-gradient(135deg, oklch(0.45 0.16 ${hue}), oklch(0.24 0.06 ${hue + 40}))`,
      }}
    >
      <span className="px-3 text-center font-display text-xl tracking-wide text-foreground/90">
        {label}
      </span>
    </div>
  );
}
