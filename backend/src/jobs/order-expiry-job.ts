import { DataSource } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { env } from "../config/env";
import { Order } from "../entities/Order";
import { toOrderSummary } from "../realtime/order-summary";
import * as realtimeEmitter from "../realtime/realtime-emitter";
import { selectOrdersForExpiry } from "../utils/order-expiry";

type ExpirySweepOptions = {
  now?: Date;
  expiryMinutes?: number;
};

export const runExpirySweepOnce = async (
  dataSource: DataSource = AppDataSource,
  options: ExpirySweepOptions = {}
): Promise<number> => {
  const now = options.now ?? new Date();
  const expiryMinutes = options.expiryMinutes ?? env.orders.expiryMinutes;

  const orderRepo = dataSource.getRepository(Order);
  const pendingOrders = await orderRepo.find({
    where: { status: "PENDING_PAYMENT" },
    relations: { orderItems: true },
    order: { createdAt: "ASC" }
  });

  const expirableOrders = selectOrdersForExpiry(pendingOrders, now, expiryMinutes);
  let expiredCount = 0;

  for (const order of expirableOrders) {
    const updateResult = await orderRepo.update(
      {
        id: order.id,
        status: "PENDING_PAYMENT"
      },
      {
        status: "EXPIRED"
      }
    );

    if (!updateResult.affected || updateResult.affected < 1) {
      continue;
    }

    const expiredOrder = await orderRepo.findOne({
      where: { id: order.id },
      relations: { orderItems: true }
    });

    if (!expiredOrder) {
      continue;
    }

    expiredCount += 1;
    realtimeEmitter.emitOrderUpdated(toOrderSummary(expiredOrder));
  }

  return expiredCount;
};

export const startOrderExpiryJob = (dataSource: DataSource = AppDataSource): NodeJS.Timeout => {
  const intervalMs = env.orders.expiryJobIntervalSeconds * 1000;

  const run = () => {
    void runExpirySweepOnce(dataSource).catch((error) => {
      console.error("Order expiry sweep failed", error);
    });
  };

  const timer = setInterval(run, intervalMs);
  return timer;
};
