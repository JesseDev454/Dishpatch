import request from "supertest";
import { createApp } from "../../app";
import { AppDataSource } from "../../config/data-source";
import { Order } from "../../entities/Order";
import { Payment } from "../../entities/Payment";
import { registerAndGetToken } from "../helpers/auth";
import { PaymentService } from "../../services/payment.service";

describe("PaymentService", () => {
  const app = createApp();
  const paymentService = new PaymentService(AppDataSource);

  const createPendingOrderFixture = async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Payments Restaurant",
      email: "payments-admin@dishpatch.test",
      password: "StrongPass123"
    });

    const category = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({ name: "Payment Meals", sortOrder: 0 });
    expect(category.status).toBe(201);

    const item = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({
        categoryId: category.body.category.id,
        name: "Payment Jollof",
        description: "For payment tests",
        price: 6399.98,
        isAvailable: true
      });
    expect(item.status).toBe(201);

    const orderResponse = await request(app)
      .post(`/public/restaurants/${auth.user.restaurant.slug}/orders`)
      .send({
        type: "PICKUP",
        customerName: "Payment Customer",
        customerPhone: "08090000000",
        deliveryAddress: null,
        items: [{ itemId: item.body.item.id, quantity: 1 }]
      });
    expect(orderResponse.status).toBe(201);

    const orderRepo = AppDataSource.getRepository(Order);
    const order = await orderRepo.findOneOrFail({ where: { id: orderResponse.body.order.id } });
    expect(order.status).toBe("PENDING_PAYMENT");

    return { order };
  };

  it("creates payment entity correctly for a pending order", async () => {
    const { order } = await createPendingOrderFixture();

    const payment = await paymentService.createPendingPayment({ id: order.id });

    expect(payment.id).toBeGreaterThan(0);
    expect(payment.orderId).toBe(order.id);
    expect(payment.provider).toBe("PAYSTACK");
    expect(payment.status).toBe("PENDING");
    expect(payment.reference).toContain("dishpatch_");
    expect(payment.amountKobo).toBe(639998);
    expect(payment.paidAt).toBeNull();

    const paymentRepo = AppDataSource.getRepository(Payment);
    const persisted = await paymentRepo.findOneOrFail({ where: { id: payment.id } });
    expect(persisted.orderId).toBe(order.id);
  });

  it("cannot create payment for non-pending order", async () => {
    const { order } = await createPendingOrderFixture();
    const orderRepo = AppDataSource.getRepository(Order);
    order.status = "PAID";
    await orderRepo.save(order);

    await expect(paymentService.createPendingPayment({ id: order.id })).rejects.toThrow(
      "Cannot initialize payment for non-pending order"
    );
  });

  it("cannot create two payments for the same order", async () => {
    const { order } = await createPendingOrderFixture();
    await paymentService.createPendingPayment({ id: order.id });

    await expect(paymentService.createPendingPayment({ id: order.id })).rejects.toThrow(
      "Payment already exists for this order"
    );
  });

  it("markPaymentSuccess updates payment and order status", async () => {
    const { order } = await createPendingOrderFixture();
    const payment = await paymentService.createPendingPayment({ id: order.id });
    const payload = {
      event: "charge.success",
      data: { providerRef: "abc123" }
    };

    const updated = await paymentService.markPaymentSuccess(payment.reference, payload);

    expect(updated.status).toBe("SUCCESS");
    expect(updated.paidAt).toBeTruthy();
    expect(updated.rawPayload).toEqual(payload);

    const orderRepo = AppDataSource.getRepository(Order);
    const paymentRepo = AppDataSource.getRepository(Payment);
    const persistedOrder = await orderRepo.findOneOrFail({ where: { id: order.id } });
    const persistedPayment = await paymentRepo.findOneOrFail({ where: { id: payment.id } });

    expect(persistedOrder.status).toBe("PAID");
    expect(persistedPayment.status).toBe("SUCCESS");
    expect(persistedPayment.paidAt).toBeTruthy();
    expect(persistedPayment.rawPayload).toEqual(payload);
  });

  it("markPaymentFailed updates order status to FAILED_PAYMENT", async () => {
    const { order } = await createPendingOrderFixture();
    const payment = await paymentService.createPendingPayment({ id: order.id });

    const failed = await paymentService.markPaymentFailed(payment.reference);
    expect(failed.status).toBe("FAILED");

    const orderRepo = AppDataSource.getRepository(Order);
    const persistedOrder = await orderRepo.findOneOrFail({ where: { id: order.id } });
    expect(persistedOrder.status).toBe("FAILED_PAYMENT");
  });

  it("double-calling markPaymentSuccess is idempotent", async () => {
    const { order } = await createPendingOrderFixture();
    const payment = await paymentService.createPendingPayment({ id: order.id });
    const paymentRepo = AppDataSource.getRepository(Payment);

    const firstPayload = { event: "charge.success", data: { first: true } };
    await paymentService.markPaymentSuccess(payment.reference, firstPayload);
    const persistedAfterFirst = await paymentRepo.findOneOrFail({ where: { id: payment.id } });

    const second = await paymentService.markPaymentSuccess(payment.reference, {
      event: "charge.success",
      data: { second: true }
    });
    const persistedAfterSecond = await paymentRepo.findOneOrFail({ where: { id: payment.id } });

    expect(second.status).toBe("SUCCESS");
    expect(persistedAfterSecond.paidAt?.toISOString()).toBe(persistedAfterFirst.paidAt?.toISOString());
    expect(persistedAfterSecond.rawPayload).toEqual(firstPayload);

    const orderRepo = AppDataSource.getRepository(Order);
    const persistedOrder = await orderRepo.findOneOrFail({ where: { id: order.id } });
    expect(persistedOrder.status).toBe("PAID");
  });
});
