import { Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

type JwtUserPayload = {
  userId: number;
  restaurantId: number;
  role: "ADMIN";
};

export type AccessTokenPayload = JwtUserPayload & {
  type: "access";
};

export type RefreshTokenPayload = JwtUserPayload & {
  type: "refresh";
};

const signToken = (payload: AccessTokenPayload | RefreshTokenPayload, secret: string, expiresIn: string): string => {
  return jwt.sign(payload, secret, { expiresIn } as SignOptions);
};

export const generateAccessToken = (payload: JwtUserPayload): string =>
  signToken({ ...payload, type: "access" }, env.jwt.accessSecret, env.jwt.accessExpires);

export const generateRefreshToken = (payload: JwtUserPayload): string =>
  signToken({ ...payload, type: "refresh" }, env.jwt.refreshSecret, env.jwt.refreshExpires);

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;

export const verifyRefreshToken = (token: string): RefreshTokenPayload =>
  jwt.verify(token, env.jwt.refreshSecret) as RefreshTokenPayload;

export const setRefreshCookie = (res: Response, refreshToken: string): void => {
  const isProduction = env.nodeEnv === "production";
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/auth"
  });
};

export const clearRefreshCookie = (res: Response): void => {
  const isProduction = env.nodeEnv === "production";
  res.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    path: "/auth"
  });
};
