import axios from "axios";

const normalizeUrl = (value: string): string => value.replace(/\/$/, "");
const absoluteUrlPattern = /^https?:\/\//i;
const isProductionBuild = import.meta.env.PROD;

const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

if (isProductionBuild && (!rawApiBaseUrl || rawApiBaseUrl.length === 0)) {
  throw new Error("Missing VITE_API_BASE_URL in production build.");
}

if (isProductionBuild && rawApiBaseUrl && !absoluteUrlPattern.test(rawApiBaseUrl)) {
  throw new Error("VITE_API_BASE_URL must be an absolute URL in production.");
}

const apiBaseUrl = rawApiBaseUrl && rawApiBaseUrl.length > 0 ? normalizeUrl(rawApiBaseUrl) : "/api";

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

export const getSocketBaseUrl = (): string => socketBaseUrl;

export const setAccessToken = (token: string | null): void => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem("dishpatch_access_token", token);
  } else {
    delete api.defaults.headers.common.Authorization;
    localStorage.removeItem("dishpatch_access_token");
  }
};

export const getStoredAccessToken = (): string | null => {
  return localStorage.getItem("dishpatch_access_token");
};
