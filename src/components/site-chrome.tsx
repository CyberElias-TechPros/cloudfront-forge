import { Link, useNavigate } from "@tanstack/react-router";
import { Flame, Menu, Trophy, Zap, LogIn, LogOut, Search } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentMember, useUserPermissions } from "@/hooks/use-api";
import { Input } from "@/components/ui/input";

const navGroups = [
  {
    label: "Core",
    links: [
      { to: "/dashboard", label: "Dashboard" },
      { to: "/queue", label: "Watch Queue" },
      { to: "/submit", label: "Submit Video" },
    ],
  },
  {
    label: "Explore",
    links: [
      { to: "/communities", label: "Communities" },
      { to: "/missions", label: "Missions" },
      { to: "/reviews", label: "Reviews" },
      { to: "/leaderboard", label: "Leaderboard" },
      { to: "/gamification", label: "Gamification" },
    ],
  },
  {
    label: "Tools",
    links: [
      { to: "/ai", label: "AI Assistant" },
      { to: "/admin", label: "Admin" },
    ],
  },
  {
    label: "Account",
    links: [
      { to: "/profile", label: "Profile" },
      { to: "/settings", label: "Settings" },
      { to: "/rules", label: "Rules" },
    ],
  },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { user, loading, signIn, signOut } = useAuth();
  const { data: member } = useCurrentMember();
  const { data: permissionsData } = useUserPermissions();
  const isAdmin = permissionsData?.role === "admin" || permissionsData?.role === "super_admin";
  const visibleGroups = navGroups
    .map((g) => ({ ...g, links: g.links.filter((l) => l.to !== "/admin" || isAdmin) }))
    .filter((g) => g.links.length > 0);

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate({ to: "/search", search: { q: searchQuery.trim() } });
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

        <nav className="ml-4 hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleGroups.map((group, gi) => (
            <div key={group.label} className="flex shrink-0 items-center gap-1">
              {gi > 0 && <span className="mx-2 h-5 w-px bg-border" aria-hidden="true" />}
              {group.links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="shrink-0 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "bg-secondary text-foreground" }}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <form onSubmit={handleSearch} className="hidden lg:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-44 pl-9 xl:w-56"
            />
          </div>
        </form>

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
        <nav className="mx-auto max-w-7xl px-4 py-3">
          {visibleGroups.map((group) => (
            <div key={group.label} className="mb-3 last:mb-0">
              <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {group.label}
              </p>
              <div className="grid gap-1">
                {group.links.map((l) => (
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
              </div>
            </div>
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
