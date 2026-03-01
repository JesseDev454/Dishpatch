import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { toast } from "sonner";
import type { AuthUser } from "../types";

const normalizeUrl = (value: string): string => value.replace(/\/$/, "");
const absoluteUrlPattern = /^https?:\/\//i;
const isProductionBuild = import.meta.env.PROD;
const expectedProductionApiBaseUrl = "https://dishpatch-8g6e.onrender.com";
const localhostUrlPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const ACCESS_TOKEN_STORAGE_KEY = "dishpatch_access_token";
const REFRESH_TOKEN_STORAGE_KEY = "dishpatch_refresh_token";

const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

if (isProductionBuild && (!rawApiBaseUrl || rawApiBaseUrl.length === 0)) {
  throw new Error("Missing VITE_API_BASE_URL in production build.");
}

if (isProductionBuild && rawApiBaseUrl && !absoluteUrlPattern.test(rawApiBaseUrl)) {
  throw new Error("VITE_API_BASE_URL must be an absolute URL in production.");
}

const apiBaseUrl = rawApiBaseUrl && rawApiBaseUrl.length > 0 ? normalizeUrl(rawApiBaseUrl) : "/api";

if (isProductionBuild) {
  if (localhostUrlPattern.test(apiBaseUrl)) {
    throw new Error("VITE_API_BASE_URL cannot point to localhost in production.");
  }

  if (apiBaseUrl !== expectedProductionApiBaseUrl) {
    throw new Error(`VITE_API_BASE_URL must be ${expectedProductionApiBaseUrl} in production.`);
  }
}

const rawSocketUrl = import.meta.env.VITE_SOCKET_URL?.trim();

if (isProductionBuild && rawSocketUrl && !absoluteUrlPattern.test(rawSocketUrl)) {
  throw new Error("VITE_SOCKET_URL must be an absolute URL in production.");
}

const socketBaseUrl =
  rawSocketUrl && rawSocketUrl.length > 0
    ? normalizeUrl(rawSocketUrl)
    : absoluteUrlPattern.test(apiBaseUrl)
      ? apiBaseUrl
      : window.location.origin;

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true
});

const refreshClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true
});

export const publicApi = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: false
});

export const getSocketBaseUrl = (): string => socketBaseUrl;

type RefreshSessionResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let refreshPromise: Promise<RefreshSessionResponse> | null = null;
let sessionExpiredToastShown = false;

const isAuthRoute = (url: string | undefined): boolean => {
  if (!url) {
    return false;
  }

  return url.includes("/auth/");
};

const clearStoredSession = (): void => {
  setAccessToken(null);
  setRefreshToken(null);
};

const showSessionExpiredToast = (): void => {
  if (sessionExpiredToastShown) {
    return;
  }

  sessionExpiredToastShown = true;
  toast("Session expired, please login.", { duration: 2600 });
};

const redirectToLoginIfProtected = (): void => {
  if (!window.location.pathname.startsWith("/dashboard")) {
    return;
  }

  showSessionExpiredToast();
  window.location.replace("/login");
};

export const setAccessToken = (token: string | null): void => {
  if (token) {
    sessionExpiredToastShown = false;
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  } else {
    delete api.defaults.headers.common.Authorization;
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  }
};

export const setRefreshToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }
};

export const getStoredAccessToken = (): string | null => {
  return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
};

export const getStoredRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
};

export const refreshAuthSession = async (): Promise<RefreshSessionResponse> => {
  if (!refreshPromise) {
    const storedRefreshToken = getStoredRefreshToken();

    refreshPromise = refreshClient
      .post<RefreshSessionResponse>("/auth/refresh", storedRefreshToken ? { refreshToken: storedRefreshToken } : undefined)
      .then((response) => {
        setAccessToken(response.data.accessToken);
        setRefreshToken(response.data.refreshToken);
        return response.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableRequestConfig | undefined;
    const status = error.response?.status;

    if (!config || status !== 401 || config._retry || isAuthRoute(config.url)) {
      return Promise.reject(error);
    }

    config._retry = true;

    try {
      await refreshAuthSession();

      const authHeader = api.defaults.headers.common.Authorization;
      if (authHeader) {
        config.headers = config.headers ?? {};
        (config.headers as Record<string, string>).Authorization = String(authHeader);
      }

      return api.request(config);
    } catch (refreshError) {
      clearStoredSession();
      redirectToLoginIfProtected();
      return Promise.reject(refreshError);
    }
  }
);
