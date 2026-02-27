import { NextFunction, Request, Response } from "express";

export const requestTiming = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const elapsedMs = Number((process.hrtime.bigint() - start) / BigInt(1_000_000));
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${elapsedMs}ms)`);
  });

  next();
};
