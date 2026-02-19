import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, getStoredAccessToken, setAccessToken } from "../lib/api";
import { AuthUser } from "../types";

type RegisterInput = {
  restaurantName: string;
  email: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const applySession = (accessToken: string, user: AuthUser, setUser: (value: AuthUser | null) => void) => {
  setAccessToken(accessToken);
  setUser(user);
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const meRes = await api.get<{ user: AuthUser }>("/auth/me");
    setUser(meRes.data.user);
  };

  useEffect(() => {
    const bootstrap = async () => {
      const existingToken = getStoredAccessToken();
      if (existingToken) {
        setAccessToken(existingToken);
      }

      try {
        await refreshUser();
      } catch {
        try {
          const refreshRes = await api.post<{ accessToken: string; user: AuthUser }>("/auth/refresh");
          applySession(refreshRes.data.accessToken, refreshRes.data.user, setUser);
        } catch {
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, []);

  const login = async (input: LoginInput) => {
    const res = await api.post<{ accessToken: string; user: AuthUser }>("/auth/login", input);
    applySession(res.data.accessToken, res.data.user, setUser);
  };

  const register = async (input: RegisterInput) => {
    const res = await api.post<{ accessToken: string; user: AuthUser }>("/auth/register", input);
    applySession(res.data.accessToken, res.data.user, setUser);
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshUser
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
};
