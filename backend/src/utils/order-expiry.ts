import { Order } from "../entities/Order";

export const DEFAULT_ORDER_EXPIRY_MINUTES = 30;

const toExpiryMs = (expiryMinutes: number): number => expiryMinutes * 60 * 1000;

export const getOrderExpiryCutoff = (
  now: Date = new Date(),
  expiryMinutes: number = DEFAULT_ORDER_EXPIRY_MINUTES
): Date => new Date(now.getTime() - toExpiryMs(expiryMinutes));

export const isPendingOrderExpired = (
  order: Pick<Order, "status" | "createdAt">,
  now: Date = new Date(),
  expiryMinutes: number = DEFAULT_ORDER_EXPIRY_MINUTES
): boolean => {
  if (order.status !== "PENDING_TRANSFER") {
    return false;
  }

  const createdAtMs = new Date(order.createdAt).getTime();
  const nowMs = now.getTime();
  return nowMs - createdAtMs >= toExpiryMs(expiryMinutes);
};

export const selectOrdersForExpiry = <T extends Pick<Order, "status" | "createdAt">>(
  orders: T[],
  now: Date = new Date(),
  expiryMinutes: number = DEFAULT_ORDER_EXPIRY_MINUTES
): T[] => orders.filter((order) => isPendingOrderExpired(order, now, expiryMinutes));
