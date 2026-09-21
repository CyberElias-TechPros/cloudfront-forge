import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { auth, signInWithGoogle, signOutUser } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { api } from "@/lib/api";
import {
  getDevSession,
  setDevSession,
  clearDevSession,
  defaultDevSession,
  devEnabled,
} from "@/lib/dev-auth";

import type { User as FirebaseUser } from "firebase/auth";

if (
  import.meta.env.PROD &&
  (import.meta.env.DEV === true || import.meta.env["VITE_USE_DEV_AUTH"] === "true")
) {
  throw new Error("Dev auth is not allowed in production");
}

interface Profile {
  id: string;
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: Profile | null;
  loading: boolean;
  /** Set when the API blocks this account (suspended / banned / deleted). */
  accountError: string | null;
  /** Set when Firebase succeeded but the backend could not bootstrap the member. */
  profileError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isAccountBlock(message: string): boolean {
  return /suspend|banned|deleted/i.test(message);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  // Invalidates an in-flight bootstrap when the Firebase user changes or signs
  // out, so a slower response for account A can never overwrite account B.
  const authSequence = useRef(0);

  const fetchProfile = useCallback(async (user: User, sequence: number): Promise<void> => {
    if (authSequence.current !== sequence) return;
    setProfileError(null);
    try {
      // Identity comes from the bearer token. The body fields are profile seed
      // data only; the Worker deliberately ignores firebaseUid/email here.
      const response = await api.post<{ user: Profile }>("/api/v1/auth/register", {
        firebaseUid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoUrl: user.photoURL,
      });
      if (authSequence.current !== sequence) return;
      setProfile(response.user);
      setAccountError(null);
    } catch (error: unknown) {
      if (authSequence.current !== sequence) return;
      const message = error instanceof Error ? error.message : "We could not prepare your account.";
      setProfile(null);
      if (isAccountBlock(message)) {
        setAccountError(message);
        setProfileError(null);
      } else {
        setAccountError(null);
        setProfileError(message);
      }
      // Keep the failure visible to diagnostics while the protected route gate
      // prevents every dashboard query from cascading behind a failed bootstrap.
      console.error("Error fetching profile:", error);
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const sequence = ++authSequence.current;
      setLoading(true);
      setFirebaseUser(user);
      setProfile(null);
      setAccountError(null);
      setProfileError(null);

      if (!user) {
        setLoading(false);
        return;
      }

      // Do not publish an authenticated app state until the backend member row
      // exists. In particular, signing in after the initial anonymous callback
      // used to mount the dashboard before /auth/register completed, producing
      // a burst of 401s followed by retries against a failed registration.
      void fetchProfile(user, sequence).finally(() => {
        if (authSequence.current === sequence) setLoading(false);
      });
    });

    return () => {
      authSequence.current += 1;
      unsubscribe();
    };
  }, [fetchProfile]);

  // In dev mode (no real Firebase project), auto-establish a dev session so the
  // whole app runs against the real backend via dev tokens without a Google login.
  useEffect(() => {
    if (!devEnabled()) return;
    if (firebaseUser) return;
    let session = getDevSession();
    if (!session) {
      session = defaultDevSession();
      setDevSession(session);
    }
    const devUser = session as unknown as User;
    const sequence = ++authSequence.current;
    setFirebaseUser(devUser);
    setLoading(true);
    void fetchProfile(devUser, sequence).finally(() => {
      if (authSequence.current === sequence) setLoading(false);
    });
  }, [firebaseUser, fetchProfile]);

  const signIn = async () => {
    if (devEnabled()) {
      let session = getDevSession();
      if (!session) {
        session = defaultDevSession();
        setDevSession(session);
      }
      const devUser = session as unknown as User;
      const sequence = ++authSequence.current;
      setFirebaseUser(devUser);
      setLoading(true);
      try {
        await fetchProfile(devUser, sequence);
      } finally {
        if (authSequence.current === sequence) setLoading(false);
      }
      return;
    }
    try {
      // The auth-state listener owns profile bootstrap. RequireAuth keeps the
      // destination behind a loading gate until that bootstrap has completed.
      await signInWithGoogle();
    } catch (error) {
      console.error("Sign in error:", error);
      throw error;
    }
  };

  const signOut = async () => {
    // Invalidate bootstrap immediately; Firebase's null callback may arrive
    // after the network response that signs the user out.
    authSequence.current += 1;
    if (devEnabled()) {
      clearDevSession();
      setFirebaseUser(null);
      setProfile(null);
      setAccountError(null);
      setProfileError(null);
      return;
    }
    try {
      await signOutUser();
      setFirebaseUser(null);
      setProfile(null);
      setAccountError(null);
      setProfileError(null);
    } catch (error) {
      console.error("Sign out error:", error);
      throw error;
    }
  };

  const refreshProfile = async () => {
    if (!firebaseUser) return;
    const sequence = ++authSequence.current;
    setLoading(true);
    try {
      await fetchProfile(firebaseUser, sequence);
    } finally {
      if (authSequence.current === sequence) setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: firebaseUser,
        profile,
        loading,
        accountError,
        profileError,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

function FullPageStatus({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[70vh] place-items-center px-4" role="status" aria-live="polite">
      {children}
    </div>
  );
}

export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, profile, loading, accountError, profileError, refreshProfile, signOut } = useAuth();
  const shouldRedirect = !loading && !user;

  useEffect(() => {
    if (shouldRedirect && typeof window !== "undefined") {
      window.location.replace("/auth/signin");
    }
  }, [shouldRedirect]);

  if (loading || (user && !profile && !accountError && !profileError)) {
    return (
      <FullPageStatus>
        <div className="text-center">
          <div className="mx-auto size-9 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Preparing your creator workspace…</p>
        </div>
      </FullPageStatus>
    );
  }

  if (shouldRedirect) return null;

  if (user && accountError) {
    return (
      <FullPageStatus>
        <div className="surface max-w-md p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-destructive">
            Account unavailable
          </p>
          <h1 className="mt-3 text-3xl">Your workspace is locked</h1>
          <p className="mt-3 text-sm text-muted-foreground">{accountError}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-6 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            Sign out
          </button>
        </div>
      </FullPageStatus>
    );
  }

  if (user && profileError) {
    return (
      <FullPageStatus>
        <div className="surface max-w-lg p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Connection interrupted
          </p>
          <h1 className="mt-3 text-3xl">We couldn’t prepare your workspace</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your Google sign-in succeeded, but CreatorLoop’s API did not finish setting up your
            member profile. No action was lost.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{profileError}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => void refreshProfile()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Try again
            </button>
            <a
              href="/support"
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
            >
              Get support
            </a>
          </div>
        </div>
      </FullPageStatus>
    );
  }

  return user && profile ? <>{children}</> : null;
};
