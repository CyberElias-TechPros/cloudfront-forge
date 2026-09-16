import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);

  const fetchProfile = async (user: User) => {
    try {
      // Call our backend to get/create user and profile
      const response = await api.post<{ user: Profile }>("/api/v1/auth/register", {
        firebaseUid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoUrl: user.photoURL,
      });
      setProfile(response.user);
      setAccountError(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      // The entry-point gate rejects suspended/banned/deleted accounts with a
      // specific message — surface it instead of showing a broken dashboard.
      if (/suspend|banned|deleted/i.test(message)) {
        setAccountError(message);
      }
      console.error("Error fetching profile:", error);
    }
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const token = await user.getIdToken(true);
          if (token) {
            localStorage.setItem("authToken", token);
          }
        } catch (e) {
          console.warn("Failed to get ID token:", e);
        }
        await fetchProfile(user);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
    setFirebaseUser(devUser);
    setLoading(true);
    fetchProfile(devUser)
      .catch((e) => console.error("Dev profile fetch failed:", e))
      .finally(() => setLoading(false));
  }, [firebaseUser]);

  const signIn = async () => {
    if (devEnabled()) {
      let session = getDevSession();
      if (!session) {
        session = defaultDevSession();
        setDevSession(session);
      }
      const devUser = session as unknown as User;
      setFirebaseUser(devUser);
      await fetchProfile(devUser);
      return;
    }
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Sign in error:", error);
      throw error;
    }
  };

  const signOut = async () => {
    if (devEnabled()) {
      clearDevSession();
      setFirebaseUser(null);
      setProfile(null);
      setAccountError(null);
      return;
    }
    try {
      await signOutUser();
      setFirebaseUser(null);
      setProfile(null);
      setAccountError(null);
    } catch (error) {
      console.error("Sign out error:", error);
      throw error;
    }
  };

  const refreshProfile = async () => {
    if (firebaseUser) {
      await fetchProfile(firebaseUser);
    }
  };

  // Ensure auth token is attached after user state stabilizes
  useEffect(() => {
    if (!auth) return;
    const firebaseAuth = auth;
    const handleAuthState = async () => {
      if (firebaseUser) {
        try {
          const user = firebaseAuth.currentUser;
          if (user) {
            const token = await user.getIdToken();
            if (token) {
              // Store token so api interceptor can pick it up
              localStorage.setItem("authToken", token);
            }
          }
        } catch (e) {
          console.warn("Failed to get ID token:", e);
        }
      }
    };
    if (loading) return;
    handleAuthState();
    const interval = setInterval(handleAuthState, 30000);
    return () => clearInterval(interval);
  }, [firebaseUser, loading]);

  return (
    <AuthContext.Provider
      value={{
        user: firebaseUser,
        profile,
        loading,
        accountError,
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

export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    window.location.href = "/auth/signin";
    return null;
  }

  return <>{children}</>;
};
