import { Server as SocketIOServer } from "socket.io";
import { OrderSummary } from "./order-summary";

const restaurantRoom = (restaurantId: number): string => `restaurant:${restaurantId}`;

type RealtimeEmitter = {
  emitOrderPaid: (order: OrderSummary) => void;
  emitOrderUpdated: (order: OrderSummary) => void;
  emitOrdersSnapshot: (restaurantId: number, orders: OrderSummary[]) => void;
};

const noopEmitter: RealtimeEmitter = {
  emitOrderPaid: () => undefined,
  emitOrderUpdated: () => undefined,
  emitOrdersSnapshot: () => undefined
};

let activeEmitter: RealtimeEmitter = noopEmitter;

export const setRealtimeEmitter = (emitter: RealtimeEmitter): void => {
  activeEmitter = emitter;
};

export const resetRealtimeEmitter = (): void => {
  activeEmitter = noopEmitter;
};

export const emitOrderPaid = (order: OrderSummary): void => {
  activeEmitter.emitOrderPaid(order);
};

export const emitOrderUpdated = (order: OrderSummary): void => {
  activeEmitter.emitOrderUpdated(order);
};

export const emitOrdersSnapshot = (restaurantId: number, orders: OrderSummary[]): void => {
  activeEmitter.emitOrdersSnapshot(restaurantId, orders);
};

export const createSocketEmitter = (io: SocketIOServer): RealtimeEmitter => ({
  emitOrderPaid: (order) => {
    io.to(restaurantRoom(order.restaurantId)).emit("order:paid", order);
  },
  emitOrderUpdated: (order) => {
    io.to(restaurantRoom(order.restaurantId)).emit("order:updated", order);
  },
  emitOrdersSnapshot: (restaurantId, orders) => {
    io.to(restaurantRoom(restaurantId)).emit("orders:snapshot", orders);
  }
});

export { restaurantRoom };
