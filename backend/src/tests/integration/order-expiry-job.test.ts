import request from "supertest";
import { createApp } from "../../app";
import { registerAndGetToken } from "../helpers/auth";
import { AppDataSource } from "../../config/data-source";
import { Order } from "../../entities/Order";
import { runExpirySweepOnce } from "../../jobs/order-expiry-job";
import * as realtimeEmitter from "../../realtime/realtime-emitter";

describe("Order Expiry Job", () => {
  const app = createApp();
  const emitOrderUpdatedSpy = jest.spyOn(realtimeEmitter, "emitOrderUpdated");

  beforeEach(() => {
    emitOrderUpdatedSpy.mockClear();
  });

  const createOrder = async (seed: string): Promise<{ orderId: number }> => {
    const auth = await registerAndGetToken(app, {
      restaurantName: `Expiry Restaurant ${seed}`,
      email: `expiry-${seed}@dishpatch.test`,
      password: "StrongPass123"
    });

    const categoryResponse = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({ name: `Expiry Category ${seed}`, sortOrder: 0 });
    expect(categoryResponse.status).toBe(201);

    const itemResponse = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({
        categoryId: categoryResponse.body.category.id,
        name: `Expiry Item ${seed}`,
        description: null,
        price: 2000,
        isAvailable: true
      });
    expect(itemResponse.status).toBe(201);

    const orderResponse = await request(app)
      .post(`/public/restaurants/${auth.user.restaurant.slug}/orders`)
      .send({
        type: "PICKUP",
        customerName: "Expiry Tester",
        customerPhone: "08010000000",
        customerEmail: `expiry-customer-${seed}@dishpatch.test`,
        deliveryAddress: null,
        items: [{ itemId: itemResponse.body.item.id, quantity: 1 }]
      });
    expect(orderResponse.status).toBe(201);

    return { orderId: orderResponse.body.order.id as number };
  };

  it("expires only old pending orders and emits realtime update", async () => {
    const pending = await createOrder("pending");
    const paid = await createOrder("paid");
    const failed = await createOrder("failed");

    const orderRepo = AppDataSource.getRepository(Order);
    const oldDate = new Date(Date.now() - 31 * 60 * 1000);

    await orderRepo.query("UPDATE `orders` SET `createdAt` = ?, `status` = 'PENDING_PAYMENT' WHERE `id` = ?", [
      oldDate,
      pending.orderId
    ]);
    await orderRepo.query("UPDATE `orders` SET `createdAt` = ?, `status` = 'PAID' WHERE `id` = ?", [oldDate, paid.orderId]);
    await orderRepo.query("UPDATE `orders` SET `createdAt` = ?, `status` = 'FAILED_PAYMENT' WHERE `id` = ?", [
      oldDate,
      failed.orderId
    ]);

    const expiredCount = await runExpirySweepOnce(AppDataSource, {
      now: new Date(),
      expiryMinutes: 30
    });

    expect(expiredCount).toBe(1);
    const pendingAfter = await orderRepo.findOneOrFail({ where: { id: pending.orderId } });
    const paidAfter = await orderRepo.findOneOrFail({ where: { id: paid.orderId } });
    const failedAfter = await orderRepo.findOneOrFail({ where: { id: failed.orderId } });

    expect(pendingAfter.status).toBe("EXPIRED");
    expect(paidAfter.status).toBe("PAID");
    expect(failedAfter.status).toBe("FAILED_PAYMENT");

    expect(emitOrderUpdatedSpy).toHaveBeenCalledTimes(1);
    expect(emitOrderUpdatedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: pending.orderId,
        status: "EXPIRED"
      })
    );

    const secondSweep = await runExpirySweepOnce(AppDataSource, {
      now: new Date(),
      expiryMinutes: 30
    });
    expect(secondSweep).toBe(0);
    expect(emitOrderUpdatedSpy).toHaveBeenCalledTimes(1);
  });
});
