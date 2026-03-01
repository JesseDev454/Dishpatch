import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, getStoredAccessToken, getStoredRefreshToken, refreshAuthSession, setAccessToken, setRefreshToken } from "../lib/api";
import { getApiStatus, isApiNetworkError } from "../lib/errors";
import { AuthUser } from "../types";
import { useToast } from "./ToastContext";

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
  bootstrapNotice: string | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const BOOTSTRAP_RETRY_NOTICE = "Connecting to server...";
const INITIAL_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 20_000;

const applySession = (
  accessToken: string,
  refreshToken: string,
  user: AuthUser,
  setUser: (value: AuthUser | null) => void
) => {
  setAccessToken(accessToken);
  setRefreshToken(refreshToken);
  setUser(user);
};

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const isTransientBootstrapError = (error: unknown): boolean => {
  if (isApiNetworkError(error)) {
    return true;
  }

  const status = getApiStatus(error);
  return typeof status === "number" && status >= 500;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { showToast } = useToast();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapNotice, setBootstrapNotice] = useState<string | null>(null);
  const bootstrapCancelledRef = useRef(false);

  const refreshUser = async () => {
    const meRes = await api.get<{ user: AuthUser }>("/auth/me");
    setUser(meRes.data.user);
  };

  useEffect(() => {
    bootstrapCancelledRef.current = false;

    const restoreSessionOnce = async (): Promise<"success" | "unauthorized" | "retry"> => {
      try {
        await refreshUser();
        return "success";
      } catch (meError: unknown) {
        if (isTransientBootstrapError(meError)) {
          return "retry";
        }

        if (getApiStatus(meError) !== 401) {
          return "retry";
        }

        try {
          const refreshRes = await refreshAuthSession();
          applySession(refreshRes.accessToken, refreshRes.refreshToken, refreshRes.user, setUser);
          return "success";
        } catch (refreshError: unknown) {
          if (isTransientBootstrapError(refreshError)) {
            return "retry";
          }

          if (getApiStatus(refreshError) === 401) {
            return "unauthorized";
          }

          return "retry";
        }
      }
    };

    const bootstrap = async () => {
      const existingToken = getStoredAccessToken();
      const existingRefreshToken = getStoredRefreshToken();
      const hadPersistedSession = Boolean(existingToken || existingRefreshToken);
      if (existingToken) {
        setAccessToken(existingToken);
      }

      let retryDelayMs = INITIAL_RETRY_DELAY_MS;
      while (!bootstrapCancelledRef.current) {
        const outcome = await restoreSessionOnce();
        if (bootstrapCancelledRef.current) {
          return;
        }

        if (outcome === "success") {
          setBootstrapNotice(null);
          setLoading(false);
          return;
        }

        if (outcome === "unauthorized") {
          if (hadPersistedSession) {
            showToast("Session expired, please login.", "info");
          }
          setAccessToken(null);
          setRefreshToken(null);
          setUser(null);
          setBootstrapNotice(null);
          setLoading(false);
          return;
        }

        setBootstrapNotice(BOOTSTRAP_RETRY_NOTICE);
        await wait(retryDelayMs);
        retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_DELAY_MS);
      }
    };

    void bootstrap();

    return () => {
      bootstrapCancelledRef.current = true;
    };
  }, [showToast]);

  const login = async (input: LoginInput) => {
    const res = await api.post<{ accessToken: string; refreshToken: string; user: AuthUser }>("/auth/login", input);
    bootstrapCancelledRef.current = true;
    applySession(res.data.accessToken, res.data.refreshToken, res.data.user, setUser);
    setBootstrapNotice(null);
    setLoading(false);
  };

  const register = async (input: RegisterInput) => {
    const res = await api.post<{ accessToken: string; refreshToken: string; user: AuthUser }>("/auth/register", input);
    bootstrapCancelledRef.current = true;
    applySession(res.data.accessToken, res.data.refreshToken, res.data.user, setUser);
    setBootstrapNotice(null);
    setLoading(false);
  };

  const logout = async () => {
    bootstrapCancelledRef.current = true;
    try {
      await api.post("/auth/logout");
    } finally {
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
      setBootstrapNotice(null);
      setLoading(false);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      bootstrapNotice,
      login,
      register,
      logout,
      refreshUser
    }),
    [user, loading, bootstrapNotice]
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
