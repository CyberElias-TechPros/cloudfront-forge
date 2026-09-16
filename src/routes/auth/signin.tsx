import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, CheckCircle2, Zap } from "lucide-react";
import { useState } from "react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth/signin")({
  head: () => ({
    meta: [
      { title: "Sign in — LoopSquad" },
      {
        name: "description",
        content: "Sign in with Google to join your LoopSquad creator feedback community.",
      },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  beforeLoad: async () => {
    if (auth?.currentUser) throw redirect({ to: "/dashboard" });
  },
  component: SignIn,
});

interface SignInError {
  code: string;
  message: string;
}

function SignIn() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SignInError | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      // AuthProvider owns both the Firebase and local development paths. This
      // keeps the sign-in screen and the header on one consistent happy path.
      await signIn();
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      const authError = err as Error & { code?: string };
      setError({
        code: authError.code || "UNEXPECTED_ERROR",
        message: authError.message || "We could not complete sign-in. Please try again.",
      });
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-[calc(100svh-4rem)] items-center overflow-hidden px-4 py-12">
      <div className="hero-aurora hero-aurora-one" aria-hidden="true" />
      <div className="hero-aurora hero-aurora-two" aria-hidden="true" />
      <div className="hero-grid" aria-hidden="true" />

      <div className="relative z-10 mx-auto w-full max-w-lg">
        <Link
          to="/"
          className="mb-7 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to home
        </Link>

        <section className="surface overflow-hidden p-7 sm:p-10">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
                <Zap className="size-6" />
              </div>
              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Your next chapter starts here
              </p>
              <h1 className="mt-3 text-5xl leading-none sm:text-6xl">Enter the loop.</h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
                Join a creator community where attention is intentional, feedback is useful, and
                progress is something you can see.
              </p>
            </div>
            <span className="hidden font-display text-5xl text-muted-foreground/20 sm:block">
              01
            </span>
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-8 flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4"
            >
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-semibold text-destructive">Sign-in needs attention</p>
                <p className="mt-1 text-xs leading-5 text-destructive/80">{error.message}</p>
                <span className="sr-only">Error code: {error.code}</span>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="button-primary mt-8 w-full disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Opening your workspace…
              </>
            ) : (
              <>
                <span className="grid size-5 place-items-center rounded-full bg-white/15 text-xs font-bold">
                  G
                </span>
                Continue with Google
              </>
            )}
          </button>

          <div className="mt-7 grid gap-3 border-t border-border/70 pt-6 text-xs text-muted-foreground">
            <p className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              Server-verified actions and one-time rewards.
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              No artificial engagement or paid subscribes.
            </p>
            <p className="pt-2 leading-5">
              By continuing, you agree to our{" "}
              <Link className="text-foreground underline" to="/terms">
                Terms
              </Link>{" "}
              and{" "}
              <Link className="text-foreground underline" to="/privacy">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
