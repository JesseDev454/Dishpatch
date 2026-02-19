import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true
});

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
