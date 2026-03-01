import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { env } from "../config/env";

const HOUR_IN_MS = 60 * 60 * 1000;
const RESET_TOKEN_BYTES = 32;

const resetRequestTimelineByEmail = new Map<string, number[]>();
const resetRequestTimelineByIp = new Map<string, number[]>();

const pruneRecentTimestamps = (timestamps: number[], nowMs: number): number[] =>
  timestamps.filter((timestamp) => nowMs - timestamp < HOUR_IN_MS);

const hasExceededResetRequestLimit = (timeline: Map<string, number[]>, key: string): boolean => {
  const nowMs = Date.now();
  const recentTimestamps = pruneRecentTimestamps(timeline.get(key) ?? [], nowMs);
  timeline.set(key, recentTimestamps);

  return recentTimestamps.length >= env.auth.resetPasswordRequestLimitPerHour;
};

const recordResetRequest = (timeline: Map<string, number[]>, key: string): void => {
  const nowMs = Date.now();
  const recentTimestamps = pruneRecentTimestamps(timeline.get(key) ?? [], nowMs);
  recentTimestamps.push(nowMs);
  timeline.set(key, recentTimestamps);
};

const getPasswordResetTokenSecret = (): string => {
  const secret = env.auth.resetPasswordTokenSecret;
  if (!secret) {
    throw new Error("Password reset not configured");
  }

  return secret;
};

export const isPasswordResetConfigured = (): boolean => typeof env.auth.resetPasswordTokenSecret === "string" && env.auth.resetPasswordTokenSecret.length > 0;

export const hashPasswordResetToken = (token: string): string =>
  createHmac("sha256", getPasswordResetTokenSecret()).update(token).digest("hex");

export const createPasswordResetToken = (): { token: string; tokenHash: string; expiresAt: Date } => {
  const token = randomBytes(RESET_TOKEN_BYTES).toString("base64url");
  return {
    token,
    tokenHash: hashPasswordResetToken(token),
    expiresAt: new Date(Date.now() + env.auth.resetPasswordTokenTtlMinutes * 60 * 1000)
  };
};

export const passwordResetTokenMatches = (storedHash: string, token: string): boolean => {
  const providedHash = hashPasswordResetToken(token);
  const stored = Buffer.from(storedHash, "hex");
  const provided = Buffer.from(providedHash, "hex");

  return stored.length === provided.length && timingSafeEqual(stored, provided);
};

export const isPasswordResetEmailRateLimited = (emailAddress: string): boolean =>
  hasExceededResetRequestLimit(resetRequestTimelineByEmail, emailAddress);

export const recordPasswordResetEmailRequest = (emailAddress: string): void => {
  recordResetRequest(resetRequestTimelineByEmail, emailAddress);
};

export const isPasswordResetIpRateLimited = (ipAddress: string | undefined): boolean => {
  if (!ipAddress) {
    return false;
  }

  return hasExceededResetRequestLimit(resetRequestTimelineByIp, ipAddress);
};

export const recordPasswordResetIpRequest = (ipAddress: string | undefined): void => {
  if (!ipAddress) {
    return;
  }

  recordResetRequest(resetRequestTimelineByIp, ipAddress);
};

export const clearPasswordResetIpRateLimiter = (): void => {
  resetRequestTimelineByEmail.clear();
  resetRequestTimelineByIp.clear();
};
