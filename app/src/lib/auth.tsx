import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { currentLang } from "@/i18n";
import { api, server, session } from "./api";
import { cancelAllReminders } from "./notifications";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (patch: Partial<User>) => Promise<User>;
  setUser: (u: User | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(async () => {
    await session.clear();
    await cancelAllReminders();
    setUser(null);
  }, []);

  useEffect(() => {
    session.onUnauthorized(() => void signOut());
    (async () => {
      try {
        await server.load();
        if (await session.load()) setUser((await api.me()).user);
      } catch {
        // Offline or token expired: stay signed out; the user can sign in again.
      } finally {
        setLoading(false);
      }
    })();
  }, [signOut]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      setUser,
      signOut,
      async signIn(email, password) {
        const r = await api.login(email.trim(), password);
        await session.set(r.token);
        setUser(r.user);
      },
      async signUp(email, password, name) {
        const r = await api.register(email.trim(), password, name.trim(), currentLang());
        await session.set(r.token);
        setUser(r.user);
      },
      async updateUser(patch) {
        const r = await api.updateMe(patch);
        setUser(r.user);
        return r.user;
      },
    }),
    [user, loading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
