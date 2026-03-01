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
    where: { status: "PENDING_TRANSFER" },
    relations: { orderItems: true },
    order: { createdAt: "ASC" }
  });

  const expirableOrders = selectOrdersForExpiry(pendingOrders, now, expiryMinutes);
  let expiredCount = 0;

  for (const order of expirableOrders) {
    const updateResult = await orderRepo.update(
      {
        id: order.id,
        status: "PENDING_TRANSFER"
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
  if (!dataSource.isInitialized) {
    throw new Error("Order expiry job requires an initialized DataSource.");
  }

  const intervalMs = env.orders.expiryJobIntervalSeconds * 1000;
  const maxBackoffMs = Math.max(intervalMs, 5 * 60 * 1000);
  let timer: NodeJS.Timeout | undefined;
  let consecutiveFailures = 0;

  const scheduleNextRun = (delayMs: number): void => {
    timer = setTimeout(() => {
      void run();
    }, delayMs);
  };

  const run = async (): Promise<void> => {
    try {
      await runExpirySweepOnce(dataSource);
      consecutiveFailures = 0;
      scheduleNextRun(intervalMs);
    } catch (error) {
      consecutiveFailures += 1;
      const backoffMs = Math.min(intervalMs * 2 ** Math.min(consecutiveFailures, 5), maxBackoffMs);
      console.error(`Order expiry sweep failed. Retrying in ${backoffMs}ms.`, error);
      scheduleNextRun(backoffMs);
    }
  };

  scheduleNextRun(intervalMs);
  if (!timer) {
    throw new Error("Failed to schedule order expiry job.");
  }

  return timer;
};

export const startExpiryJob = startOrderExpiryJob;
