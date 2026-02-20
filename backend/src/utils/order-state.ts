import { OrderStatus } from "../entities/Order";

const ALLOWED_NEXT_STATES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING_PAYMENT: ["PAID", "FAILED_PAYMENT"]
};

export const canTransitionOrderStatus = (current: OrderStatus, next: OrderStatus): boolean => {
  if (current === next) {
    return true;
  }

  const allowed = ALLOWED_NEXT_STATES[current] ?? [];
  return allowed.includes(next);
};

export const assertOrderStatusTransition = (current: OrderStatus, next: OrderStatus): void => {
  if (!canTransitionOrderStatus(current, next)) {
    throw new Error(`Invalid order status transition: ${current} -> ${next}`);
  }
};
