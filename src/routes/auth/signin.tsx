import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { ArrowLeft, Zap, AlertCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { auth } from "@/lib/firebase";
import { useState, useEffect } from "react";
import { attemptGoogleSignIn, watchAuthState } from "@/lib/auth-diagnostics";

export const Route = createFileRoute("/auth/signin")({
  beforeLoad: async () => {
    const user = auth?.currentUser;
    if (user) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: SignIn,
});

interface SignInError {
  code: string;
  message: string;
  details?: string;
}

function SignIn() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SignInError | null>(null);

  useEffect(() => {
    const unsubscribe = watchAuthState(
      (user) => {
        console.debug("Authentication successful, redirecting to dashboard");
        navigate({ to: "/dashboard" });
      },
      (err) => {
        console.error("Auth flow error:", err);
        setError({
          code: "AUTH_ERROR",
          message: err.message || "An authentication error occurred",
        });
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await attemptGoogleSignIn();
      if (!result.success && result.error) {
        setError(result.error);
        setLoading(false);
      }
      // Success case: auth state change watcher will handle redirect
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Unexpected sign-in error:", error);
      setError({
        code: "UNEXPECTED_ERROR",
        message: error.message || "An unexpected error occurred",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <Link
          to="/"
          className="flex items-center gap-2 mb-8 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to home
        </Link>

        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <span className="grid size-12 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Zap className="size-6" />
              </span>
            </div>
            <h1 className="text-3xl font-bold mb-2">Welcome to CreatorLoop</h1>
            <p className="text-muted-foreground">
              Sign in to access your creator community dashboard
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <div className="flex gap-3">
                <AlertCircle className="size-5 flex-shrink-0 text-destructive mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-destructive mb-1">{error.message}</h3>
                  {error.details && <p className="text-sm text-destructive/80">{error.details}</p>}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-lg bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {loading ? (
              "Signing in..."
            ) : (
              <>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"
                    fill="currentColor"
                  />
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border"></span>
            </div>
            <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground uppercase">
              Or
            </span>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            By signing in, you agree to our Terms of Service and Privacy Policy. CreatorLoop helps
            creators support each other legitimately — no artificial engagement.
          </p>

          <div className="mt-8 p-4 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-xs text-blue-900">
              <strong>Having trouble signing in?</strong> Check the browser console for detailed
              error messages, or see{" "}
              <code className="bg-white px-1 rounded">FIREBASE_SETUP.md</code> and{" "}
              <code className="bg-white px-1 rounded">ENV_CONFIGURATION.md</code> for setup
              instructions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
