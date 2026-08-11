import { Link } from "@tanstack/react-router";
import { Flame, Menu, Trophy, Zap } from "lucide-react";
import { useState } from "react";
import { currentUser } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/queue", label: "Watch Queue" },
  { to: "/submit", label: "Submit Video" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/profile", label: "Profile" },
  { to: "/rules", label: "Rules" },
  { to: "/admin", label: "Admin" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

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
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm sm:flex">
            <Flame className="size-4 text-accent" />
            {currentUser.streak}d
          </span>
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm sm:flex">
            <Trophy className="size-4 text-accent" />
            {currentUser.points.toLocaleString()} pts
          </span>
          <Link
            to="/profile"
            className="grid size-9 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground"
          >
            {currentUser.avatar}
          </Link>
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
        <p>Frontend preview · no real YouTube actions are performed.</p>
      </div>
    </footer>
  );
}
