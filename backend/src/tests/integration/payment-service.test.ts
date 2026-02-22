import request from "supertest";
import { createApp } from "../../app";
import { AppDataSource } from "../../config/data-source";
import { Order } from "../../entities/Order";
import { Payment } from "../../entities/Payment";
import { registerAndGetToken } from "../helpers/auth";
import { PaymentService } from "../../services/payment.service";
import * as realtimeEmitter from "../../realtime/realtime-emitter";
import * as asyncJobs from "../../jobs/async-jobs";

const resendSendMock = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: resendSendMock
    }
  }))
}));

describe("PaymentService", () => {
  const app = createApp();
  const paymentService = new PaymentService(AppDataSource);
  const emitOrderPaidSpy = jest.spyOn(realtimeEmitter, "emitOrderPaid");
  const enqueueAsyncJobSpy = jest.spyOn(asyncJobs, "enqueueAsyncJob");
  const consoleInfoSpy = jest.spyOn(console, "info").mockImplementation(() => undefined);

  beforeEach(() => {
    emitOrderPaidSpy.mockClear();
    enqueueAsyncJobSpy.mockClear();
    consoleInfoSpy.mockClear();
    resendSendMock.mockReset();
    resendSendMock.mockResolvedValue({ id: "email_mock_id" });
  });

  afterAll(() => {
    consoleInfoSpy.mockRestore();
  });

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
        customerEmail: "payment-customer@dishpatch.test",
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
    expect(emitOrderPaidSpy).toHaveBeenCalledTimes(1);
    expect(enqueueAsyncJobSpy).toHaveBeenCalledTimes(1);
    expect(emitOrderPaidSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: order.id,
        status: "PAID"
      })
    );

    await asyncJobs.waitForAsyncJobs();
    const paymentWithEmailMetadata = await paymentRepo.findOneOrFail({ where: { id: payment.id } });
    expect(paymentWithEmailMetadata.customerReceiptEmailMessageId).toBe("email_mock_id");
    expect(paymentWithEmailMetadata.customerReceiptEmailSentAt).toBeTruthy();
    expect(paymentWithEmailMetadata.restaurantNotificationEmailMessageId).toBe("email_mock_id");
    expect(paymentWithEmailMetadata.restaurantNotificationEmailSentAt).toBeTruthy();
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "Customer receipt email sent",
      expect.objectContaining({
        orderId: order.id,
        paymentReference: payment.reference,
        recipient: "payment-customer@dishpatch.test",
        resendMessageId: "email_mock_id"
      })
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "Restaurant notification email sent",
      expect.objectContaining({
        orderId: order.id,
        paymentReference: payment.reference,
        resendMessageId: "email_mock_id"
      })
    );
    expect(resendSendMock).toHaveBeenCalledTimes(2);
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
    expect(emitOrderPaidSpy).toHaveBeenCalledTimes(1);
    expect(enqueueAsyncJobSpy).toHaveBeenCalledTimes(1);

    await asyncJobs.waitForAsyncJobs();
    expect(resendSendMock).toHaveBeenCalledTimes(2);

    const orderRepo = AppDataSource.getRepository(Order);
    const persistedOrder = await orderRepo.findOneOrFail({ where: { id: order.id } });
    expect(persistedOrder.status).toBe("PAID");
  });

  it("queues email sending asynchronously after payment success", async () => {
    const queuedJobs: Array<() => Promise<void>> = [];
    enqueueAsyncJobSpy.mockImplementationOnce((job) => {
      queuedJobs.push(job);
    });

    const { order } = await createPendingOrderFixture();
    const payment = await paymentService.createPendingPayment({ id: order.id });

    const result = await paymentService.markPaymentSuccess(payment.reference, {
      event: "charge.success",
      data: { via: "async-queue" }
    });

    expect(result.status).toBe("SUCCESS");
    expect(queuedJobs).toHaveLength(1);
    expect(resendSendMock).toHaveBeenCalledTimes(0);

    await queuedJobs[0]();
    expect(resendSendMock).toHaveBeenCalledTimes(2);
  });

  it("does not fail payment success when email send errors", async () => {
    const { order } = await createPendingOrderFixture();
    const payment = await paymentService.createPendingPayment({ id: order.id });
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      resendSendMock.mockRejectedValueOnce(new Error("email down"));
      resendSendMock.mockRejectedValueOnce(new Error("email down"));

      const result = await paymentService.markPaymentSuccess(payment.reference, {
        event: "charge.success",
        data: { via: "test" }
      });

      expect(result.status).toBe("SUCCESS");
      const orderRepo = AppDataSource.getRepository(Order);
      const persistedOrder = await orderRepo.findOneOrFail({ where: { id: order.id } });
      expect(persistedOrder.status).toBe("PAID");
      await asyncJobs.waitForAsyncJobs();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
