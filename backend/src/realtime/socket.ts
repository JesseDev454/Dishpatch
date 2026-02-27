import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { In } from "typeorm";
import { env } from "../config/env";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import { Order, ORDER_STATUSES } from "../entities/Order";
import { verifyAccessToken } from "../utils/jwt";
import { createSocketEmitter, orderRoom, restaurantRoom, setRealtimeEmitter } from "./realtime-emitter";
import { toOrderSummary } from "./order-summary";

type SocketAuthUser = {
  userId: number;
  restaurantId: number;
  role: "ADMIN";
};

type PublicSubscribePayload = {
  orderId?: unknown;
};

type SubscribeAck = (response: { ok: boolean; message?: string }) => void;

type SocketSession =
  | {
      kind: "admin";
      authUser: SocketAuthUser;
    }
  | {
      kind: "public";
    };

const allowedOriginPattern = /^http:\/\/localhost:\d+$/;
const normalizeOrigin = (origin: string): string => origin.replace(/\/$/, "");
const requiredProductionOrigin = "https://dishpatch.vercel.app";
const allowedOrigins = new Set([...env.frontendUrls.map(normalizeOrigin), normalizeOrigin(requiredProductionOrigin)]);

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
    const token = resolveToken(socket);
    if (!token) {
      socket.data.session = { kind: "public" } as SocketSession;
      next();
      return;
    }

    try {
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

      socket.data.session = {
        kind: "admin",
        authUser: {
          userId: payload.userId,
          restaurantId: payload.restaurantId,
          role: payload.role
        }
      } as SocketSession;

      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const session = socket.data.session as SocketSession | undefined;
    if (!session) {
      socket.disconnect(true);
      return;
    }

    if (session.kind === "admin") {
      const room = restaurantRoom(session.authUser.restaurantId);
      await socket.join(room);

      try {
        const snapshot = await getRecentOrderSnapshot(session.authUser.restaurantId);
        socket.emit("orders:snapshot", snapshot);
      } catch (error) {
        console.error("Failed to emit orders snapshot", error);
      }
    }

    socket.on("order:subscribe", async (payload: PublicSubscribePayload, ack?: SubscribeAck) => {
      const orderId = Number(payload?.orderId);
      if (!Number.isInteger(orderId) || orderId < 1) {
        ack?.({ ok: false, message: "Invalid order id" });
        return;
      }

      try {
        const orderRepo = AppDataSource.getRepository(Order);
        const exists = await orderRepo.exist({ where: { id: orderId } });
        if (!exists) {
          ack?.({ ok: false, message: "Order not found" });
          return;
        }

        await socket.join(orderRoom(orderId));
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, message: "Subscription failed" });
      }
    });
  });

  setRealtimeEmitter(createSocketEmitter(io));
  return io;
};
