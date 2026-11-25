import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, tokenStore } from "../lib/api";
import type { User } from "../lib/types";

interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  acceptPrivacy: boolean;
  marketingConsent: boolean;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: RegisterInput) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const r = await api<{ user: User }>("/auth/me");
      setUser(r.user);
    } catch {
      tokenStore.set(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      refresh,
      setUser,
      async login(email, password) {
        const r = await api<{ token: string; user: User }>("/auth/login", { method: "POST", body: { email, password } });
        tokenStore.set(r.token);
        setUser(r.user);
        window.dispatchEvent(new Event("apu:login"));
        return r.user;
      },
      async register(data) {
        const body = { ...data, phone: data.phone || undefined };
        const r = await api<{ token: string; user: User }>("/auth/register", { method: "POST", body });
        tokenStore.set(r.token);
        setUser(r.user);
        window.dispatchEvent(new Event("apu:login"));
        return r.user;
      },
      logout() {
        tokenStore.set(null);
        setUser(null);
        window.dispatchEvent(new Event("apu:logout"));
      },
    }),
    [user, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fuera de AuthProvider");
  return ctx;
}
