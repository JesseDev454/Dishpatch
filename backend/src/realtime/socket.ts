import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { In } from "typeorm";
import { env } from "../config/env";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import { Order, ORDER_STATUSES } from "../entities/Order";
import { verifyAccessToken } from "../utils/jwt";
import { createSocketEmitter, restaurantRoom, setRealtimeEmitter } from "./realtime-emitter";
import { toOrderSummary } from "./order-summary";

type SocketAuthUser = {
  userId: number;
  restaurantId: number;
  role: "ADMIN";
};

const allowedOriginPattern = /^http:\/\/localhost:\d+$/;
const normalizeOrigin = (origin: string): string => origin.replace(/\/$/, "");
const allowedOrigins = new Set(env.frontendUrls.map(normalizeOrigin));

const resolveToken = (socket: Socket): string | null => {
  const fromAuth =
    typeof socket.handshake.auth?.token === "string" && socket.handshake.auth.token.trim().length > 0
      ? socket.handshake.auth.token.trim()
      : null;
  const fromHeader =
    typeof socket.handshake.headers.authorization === "string"
      ? socket.handshake.headers.authorization.trim()
      : null;

  const rawToken = fromAuth ?? fromHeader;
  if (!rawToken) {
    return null;
  }

  if (rawToken.startsWith("Bearer ")) {
    return rawToken.replace("Bearer ", "").trim();
  }

  return rawToken;
};

const getRecentOrderSnapshot = async (restaurantId: number): Promise<ReturnType<typeof toOrderSummary>[]> => {
  const orderRepo = AppDataSource.getRepository(Order);
  const recent = await orderRepo.find({
    where: {
      restaurantId,
      status: In(ORDER_STATUSES)
    },
    relations: { orderItems: true },
    order: { createdAt: "DESC" },
    take: 50
  });

  return recent.map((order) => toOrderSummary(order));
};

export const createRealtimeServer = (httpServer: HttpServer): SocketIOServer => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        const normalizedOrigin = normalizeOrigin(origin);

        if (allowedOrigins.has(normalizedOrigin) || (env.nodeEnv !== "production" && allowedOriginPattern.test(origin))) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin not allowed by CORS"));
      },
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = resolveToken(socket);
      if (!token) {
        next(new Error("Unauthorized"));
        return;
      }

      const payload = verifyAccessToken(token);
      if (payload.type !== "access") {
        next(new Error("Unauthorized"));
        return;
      }

      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: {
          id: payload.userId,
          restaurantId: payload.restaurantId
        }
      });

      if (!user) {
        next(new Error("Unauthorized"));
        return;
      }

      socket.data.authUser = {
        userId: payload.userId,
        restaurantId: payload.restaurantId,
        role: payload.role
      } as SocketAuthUser;

      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const authUser = socket.data.authUser as SocketAuthUser | undefined;
    if (!authUser) {
      socket.disconnect(true);
      return;
    }

    const room = restaurantRoom(authUser.restaurantId);
    await socket.join(room);

    try {
      const snapshot = await getRecentOrderSnapshot(authUser.restaurantId);
      socket.emit("orders:snapshot", snapshot);
    } catch (error) {
      console.error("Failed to emit orders snapshot", error);
    }
  });

  setRealtimeEmitter(createSocketEmitter(io));
  return io;
};
