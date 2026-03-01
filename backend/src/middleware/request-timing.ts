import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export const requestTiming = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint();
  const existingRequestIdHeader = req.headers["x-request-id"];
  const requestId =
    typeof existingRequestIdHeader === "string" && existingRequestIdHeader.trim().length > 0
      ? existingRequestIdHeader.trim()
      : randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  res.on("finish", () => {
    if (env.nodeEnv === "test") {
      return;
    }

    const elapsedMs = Number((process.hrtime.bigint() - start) / BigInt(1_000_000));
    console.log(`[${requestId}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${elapsedMs}ms)`);
  });

  next();
};
