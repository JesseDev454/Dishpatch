import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  if (error instanceof ZodError) {
    const first = error.issues[0];
    res.status(400).json({ message: first?.message ?? "Validation failed" });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Internal server error" });
};
