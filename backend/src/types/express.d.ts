import type { AuthUser } from "../middleware/auth";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
      rawBody?: Buffer;
      requestId?: string;
    }
  }
}

export {};
