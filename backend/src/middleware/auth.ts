import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";

export type AuthUser = {
  userId: number;
  restaurantId: number;
  role: "ADMIN";
};

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const token = authHeader.replace("Bearer ", "").trim();

  try {
    const payload = verifyAccessToken(token);
    if (payload.type !== "access") {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    req.authUser = {
      userId: payload.userId,
      restaurantId: payload.restaurantId,
      role: payload.role
    };

    next();
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
};
