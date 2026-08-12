import { Link, useNavigate } from "@tanstack/react-router";
import { Flame, Menu, Trophy, Zap, LogIn, LogOut } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentMember } from "@/hooks/use-api";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/queue", label: "Watch Queue" },
  { to: "/submit", label: "Submit Video" },
  { to: "/communities", label: "Communities" },
  { to: "/missions", label: "Missions" },
  { to: "/reviews", label: "Reviews" },
  { to: "/gamification", label: "Gamification" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/profile", label: "Profile" },
  { to: "/rules", label: "Rules" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, loading, signIn, signOut } = useAuth();
  const { data: member } = useCurrentMember();

  const handleSignIn = async () => {
    try {
      await signIn();
      navigate({ to: "/dashboard" });
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate({ to: "/" });
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "??";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      const first = parts[0]?.[0] ?? "";
      const last = parts[parts.length - 1]?.[0] ?? "";
      return (first + last).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="size-5" />
          </span>
          <span className="font-display text-2xl leading-none tracking-wide">
            Loop<span className="text-primary">Squad</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {loading ? (
            <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
          ) : user ? (
            <>
              <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm sm:flex">
                <Flame className="size-4 text-accent" />
                {member?.streak ?? 0}d
              </span>
              <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm sm:flex">
                <Trophy className="size-4 text-accent" />
                {member?.points ?? 0} pts
              </span>
              <Link
                to="/profile"
                className="grid size-9 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    className="size-9 rounded-full object-cover"
                  />
                ) : (
                  getInitials(user.displayName)
                )}
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="grid size-9 place-items-center rounded-md border border-border hover:bg-secondary"
                title="Sign Out"
              >
                <LogOut className="size-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              <LogIn className="size-4" /> Sign in
            </button>
          )}
          <button
            type="button"
            aria-label="Toggle navigation"
            onClick={() => setOpen((v) => !v)}
            className="grid size-9 place-items-center rounded-md border border-border lg:hidden"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>

      <div className={cn("border-t border-border lg:hidden", open ? "block" : "hidden")}>
        <nav className="mx-auto grid max-w-7xl gap-1 px-4 py-3">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              {l.label}
            </Link>
          ))}
          {!user && (
            <button
              onClick={handleSignIn}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Sign in
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border/70">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>LoopSquad — fair growth for WhatsApp creator groups.</p>
        <p className="text-xs">
          Using API at: {import.meta.env["VITE_API_URL"] || "http://localhost:8787"}
        </p>
      </div>
    </footer>
  );
}
