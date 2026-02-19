import axios from "axios";

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? fallback;
  }
  return fallback;
};

export const getApiStatus = (error: unknown): number | undefined => {
  if (axios.isAxiosError(error)) {
    return error.response?.status;
  }
  return undefined;
};
