import request from "supertest";
import crypto from "crypto";
import axios from "axios";
import { createApp } from "../../app";
import { registerAndGetToken } from "../helpers/auth";
import { AppDataSource } from "../../config/data-source";
import { Order } from "../../entities/Order";
import { Payment } from "../../entities/Payment";
import { PaymentService } from "../../services/payment.service";
import { env } from "../../config/env";

jest.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Paystack Integration", () => {
  const app = createApp();
  const postMock = jest.fn();
  const getMock = jest.fn();

  const makeWebhookSignature = (payload: Record<string, unknown>): string => {
    const raw = JSON.stringify(payload);
    return crypto.createHmac("sha512", env.paystack.secretKey).update(raw).digest("hex");
  };

  beforeEach(() => {
    postMock.mockReset();
    getMock.mockReset();
    mockedAxios.create.mockReturnValue({ post: postMock, get: getMock } as any);
  });

  const createOrderFixture = async (override?: Partial<{ email: string }>) => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Paystack Restaurant",
      email: "paystack-admin@dishpatch.test",
      password: "StrongPass123"
    });

    const category = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({ name: "Paystack Meals", sortOrder: 0 });
    expect(category.status).toBe(201);

    const item = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({
        categoryId: category.body.category.id,
        name: "Paystack Jollof",
        description: "For payments",
        price: 6399.98,
        isAvailable: true
      });
    expect(item.status).toBe(201);

    const orderResponse = await request(app)
      .post(`/public/restaurants/${auth.user.restaurant.slug}/orders`)
      .send({
        type: "PICKUP",
        customerName: "Paystack Customer",
        customerPhone: "08090000000",
        customerEmail: override?.email ?? "paystack.customer@dishpatch.test",
        deliveryAddress: null,
        items: [{ itemId: item.body.item.id, quantity: 1 }]
      });
    expect(orderResponse.status).toBe(201);

    return { auth, orderId: orderResponse.body.order.id as number };
  };

  it("initializes Paystack transaction and creates payment", async () => {
    const { orderId } = await createOrderFixture();

    postMock.mockResolvedValue({
      data: {
        status: true,
        message: "Authorization URL created",
        data: {
          authorization_url: "https://paystack.com/pay/abc",
          access_code: "access_code",
          reference: "ref_123"
        }
      }
    });

    const response = await request(app)
      .post(`/public/orders/${orderId}/paystack/initialize`)
      .send({ email: "paystack.customer@dishpatch.test" });

    expect(response.status).toBe(200);
    expect(response.body.authorizationUrl).toBe("https://paystack.com/pay/abc");
    expect(response.body.reference).toBe("ref_123");

    const paymentRepo = AppDataSource.getRepository(Payment);
    const payment = await paymentRepo.findOneOrFail({ where: { orderId } });
    expect(payment.status).toBe("PENDING");
    expect(payment.amountKobo).toBe(639998);
  });

  it("cannot initialize twice while payment is still pending", async () => {
    const { orderId } = await createOrderFixture();

    postMock.mockResolvedValue({
      data: {
        status: true,
        message: "Authorization URL created",
        data: {
          authorization_url: "https://paystack.com/pay/pending1",
          access_code: "access_code",
          reference: "pending_ref_1"
        }
      }
    });

    const first = await request(app)
      .post(`/public/orders/${orderId}/paystack/initialize`)
      .send({ email: "paystack.customer@dishpatch.test" });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/public/orders/${orderId}/paystack/initialize`)
      .send({ email: "paystack.customer@dishpatch.test" });
    expect(second.status).toBe(400);
  });

  it("rejects initialize when order already paid", async () => {
    const { orderId } = await createOrderFixture();
    const orderRepo = AppDataSource.getRepository(Order);
    const order = await orderRepo.findOneOrFail({ where: { id: orderId } });
    order.status = "PAID";
    await orderRepo.save(order);

    const response = await request(app)
      .post(`/public/orders/${orderId}/paystack/initialize`)
      .send({ email: "paystack.customer@dishpatch.test" });

    expect(response.status).toBe(400);
  });

  it("rejects initialize when order not found", async () => {
    const response = await request(app)
      .post("/public/orders/999999/paystack/initialize")
      .send({ email: "paystack.customer@dishpatch.test" });

    expect(response.status).toBe(404);
  });

  it("can initialize again only after previous payment failed", async () => {
    const { orderId } = await createOrderFixture();

    postMock
      .mockResolvedValueOnce({
        data: {
          status: true,
          message: "Authorization URL created",
          data: {
            authorization_url: "https://paystack.com/pay/first",
            access_code: "access_code_1",
            reference: "first_ref"
          }
        }
      })
      .mockResolvedValueOnce({
        data: {
          status: true,
          message: "Authorization URL created",
          data: {
            authorization_url: "https://paystack.com/pay/second",
            access_code: "access_code_2",
            reference: "second_ref"
          }
        }
      });

    const firstInit = await request(app)
      .post(`/public/orders/${orderId}/paystack/initialize`)
      .send({ email: "paystack.customer@dishpatch.test" });
    expect(firstInit.status).toBe(200);

    const paymentRepo = AppDataSource.getRepository(Payment);
    const existing = await paymentRepo.findOneOrFail({ where: { orderId } });
    const oldReference = existing.reference;

    const paymentService = new PaymentService(AppDataSource);
    await paymentService.markPaymentFailed(oldReference);

    const secondInit = await request(app)
      .post(`/public/orders/${orderId}/paystack/initialize`)
      .send({ email: "paystack.customer@dishpatch.test" });
    expect(secondInit.status).toBe(200);

    const refreshed = await paymentRepo.findOneOrFail({ where: { orderId } });
    expect(refreshed.status).toBe("PENDING");
    expect(refreshed.reference).not.toBe(oldReference);
  });

  it("marks stale pending order as EXPIRED and rejects initialize", async () => {
    const { orderId } = await createOrderFixture();
    const orderRepo = AppDataSource.getRepository(Order);
    const staleDate = new Date(Date.now() - 31 * 60 * 1000);

    await orderRepo.query("UPDATE `orders` SET `createdAt` = ?, `status` = 'PENDING_PAYMENT' WHERE `id` = ?", [
      staleDate,
      orderId
    ]);

    const response = await request(app)
      .post(`/public/orders/${orderId}/paystack/initialize`)
      .send({ email: "paystack.customer@dishpatch.test" });

    expect(response.status).toBe(400);
    const persistedOrder = await orderRepo.findOneOrFail({ where: { id: orderId } });
    expect(persistedOrder.status).toBe("EXPIRED");
  });

  it("cannot initialize payment for already expired order", async () => {
    const { orderId } = await createOrderFixture();
    const orderRepo = AppDataSource.getRepository(Order);
    const order = await orderRepo.findOneOrFail({ where: { id: orderId } });
    order.status = "EXPIRED";
    await orderRepo.save(order);

    const response = await request(app)
      .post(`/public/orders/${orderId}/paystack/initialize`)
      .send({ email: "paystack.customer@dishpatch.test" });

    expect(response.status).toBe(400);
  });

  it("verify attempt on stale pending order marks order as EXPIRED and rejects", async () => {
    const { orderId } = await createOrderFixture();
    const paymentService = new PaymentService(AppDataSource);
    const payment = await paymentService.createPendingPayment({ id: orderId });

    const orderRepo = AppDataSource.getRepository(Order);
    const staleDate = new Date(Date.now() - 31 * 60 * 1000);
    await orderRepo.query("UPDATE `orders` SET `createdAt` = ?, `status` = 'PENDING_PAYMENT' WHERE `id` = ?", [
      staleDate,
      orderId
    ]);

    const response = await request(app).get(`/public/payments/paystack/verify?reference=${payment.reference}`);
    expect(response.status).toBe(400);

    const persisted = await orderRepo.findOneOrFail({ where: { id: orderId } });
    expect(persisted.status).toBe("EXPIRED");
    expect(getMock).not.toHaveBeenCalled();
  });

  it("verify success marks payment and order as paid", async () => {
    const { orderId } = await createOrderFixture();
    const paymentService = new PaymentService(AppDataSource);
    const payment = await paymentService.createPendingPayment({ id: orderId });

    getMock.mockResolvedValue({
      data: {
        status: true,
        message: "Verification successful",
        data: {
          status: "success",
          reference: payment.reference,
          amount: payment.amountKobo
        }
      }
    });

    const response = await request(app).get(`/public/payments/paystack/verify?reference=${payment.reference}`);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");

    const paymentRepo = AppDataSource.getRepository(Payment);
    const persistedPayment = await paymentRepo.findOneOrFail({ where: { id: payment.id } });
    expect(persistedPayment.status).toBe("SUCCESS");

    const orderRepo = AppDataSource.getRepository(Order);
    const persistedOrder = await orderRepo.findOneOrFail({ where: { id: orderId } });
    expect(persistedOrder.status).toBe("PAID");
  });

  it("verify failed marks payment and order as failed", async () => {
    const { orderId } = await createOrderFixture();
    const paymentService = new PaymentService(AppDataSource);
    const payment = await paymentService.createPendingPayment({ id: orderId });

    getMock.mockResolvedValue({
      data: {
        status: true,
        message: "Verification failed",
        data: {
          status: "failed",
          reference: payment.reference,
          amount: payment.amountKobo
        }
      }
    });

    const response = await request(app).get(`/public/payments/paystack/verify?reference=${payment.reference}`);
    expect(response.status).toBe(400);

    const paymentRepo = AppDataSource.getRepository(Payment);
    const persistedPayment = await paymentRepo.findOneOrFail({ where: { id: payment.id } });
    expect(persistedPayment.status).toBe("FAILED");

    const orderRepo = AppDataSource.getRepository(Order);
    const persistedOrder = await orderRepo.findOneOrFail({ where: { id: orderId } });
    expect(persistedOrder.status).toBe("FAILED_PAYMENT");
  });

  it("double verify is idempotent after success", async () => {
    const { orderId } = await createOrderFixture();
    const paymentService = new PaymentService(AppDataSource);
    const payment = await paymentService.createPendingPayment({ id: orderId });

    getMock.mockResolvedValueOnce({
      data: {
        status: true,
        message: "Verification successful",
        data: {
          status: "success",
          reference: payment.reference,
          amount: payment.amountKobo
        }
      }
    });

    const first = await request(app).get(`/public/payments/paystack/verify?reference=${payment.reference}`);
    expect(first.status).toBe(200);

    const second = await request(app).get(`/public/payments/paystack/verify?reference=${payment.reference}`);
    expect(second.status).toBe(200);

    const paymentRepo = AppDataSource.getRepository(Payment);
    const persistedPayment = await paymentRepo.findOneOrFail({ where: { id: payment.id } });
    expect(persistedPayment.status).toBe("SUCCESS");
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it("allows FAILED payment to upgrade to SUCCESS only when verify says success", async () => {
    const { orderId } = await createOrderFixture();
    const paymentService = new PaymentService(AppDataSource);
    const payment = await paymentService.createPendingPayment({ id: orderId });

    getMock.mockResolvedValueOnce({
      data: {
        status: true,
        message: "Verification failed",
        data: {
          status: "failed",
          reference: payment.reference,
          amount: payment.amountKobo
        }
      }
    });

    const failed = await request(app).get(`/public/payments/paystack/verify?reference=${payment.reference}`);
    expect(failed.status).toBe(400);

    getMock.mockResolvedValueOnce({
      data: {
        status: true,
        message: "Verification successful",
        data: {
          status: "success",
          reference: payment.reference,
          amount: payment.amountKobo
        }
      }
    });

    const recovered = await request(app).get(`/public/payments/paystack/verify?reference=${payment.reference}`);
    expect(recovered.status).toBe(200);

    const paymentRepo = AppDataSource.getRepository(Payment);
    const orderRepo = AppDataSource.getRepository(Order);
    const persistedPayment = await paymentRepo.findOneOrFail({ where: { id: payment.id } });
    const persistedOrder = await orderRepo.findOneOrFail({ where: { id: orderId } });
    expect(persistedPayment.status).toBe("SUCCESS");
    expect(persistedOrder.status).toBe("PAID");
  });

  it("webhook validates signature and marks payment success", async () => {
    const { orderId } = await createOrderFixture();
    const paymentService = new PaymentService(AppDataSource);
    const payment = await paymentService.createPendingPayment({ id: orderId });

    const payload = {
      event: "charge.success",
      data: { reference: payment.reference }
    };

    const raw = JSON.stringify(payload);
    const signature = makeWebhookSignature(payload);

    const response = await request(app)
      .post("/webhooks/paystack")
      .set("x-paystack-signature", signature)
      .set("Content-Type", "application/json")
      .send(raw);

    expect(response.status).toBe(200);

    const paymentRepo = AppDataSource.getRepository(Payment);
    const persistedPayment = await paymentRepo.findOneOrFail({ where: { id: payment.id } });
    expect(persistedPayment.status).toBe("SUCCESS");

    const orderRepo = AppDataSource.getRepository(Order);
    const persistedOrder = await orderRepo.findOneOrFail({ where: { id: orderId } });
    expect(persistedOrder.status).toBe("PAID");
  });

  it("duplicate webhook charge.success event does not break state", async () => {
    const { orderId } = await createOrderFixture();
    const paymentService = new PaymentService(AppDataSource);
    const payment = await paymentService.createPendingPayment({ id: orderId });

    const payload = {
      event: "charge.success",
      data: { reference: payment.reference }
    };

    const signature = makeWebhookSignature(payload);

    const first = await request(app)
      .post("/webhooks/paystack")
      .set("x-paystack-signature", signature)
      .set("Content-Type", "application/json")
      .send(JSON.stringify(payload));
    expect(first.status).toBe(200);

    const paymentRepo = AppDataSource.getRepository(Payment);
    const beforeDuplicate = await paymentRepo.findOneOrFail({ where: { id: payment.id } });

    const second = await request(app)
      .post("/webhooks/paystack")
      .set("x-paystack-signature", signature)
      .set("Content-Type", "application/json")
      .send(JSON.stringify(payload));
    expect(second.status).toBe(200);

    const afterDuplicate = await paymentRepo.findOneOrFail({ where: { id: payment.id } });
    expect(afterDuplicate.status).toBe("SUCCESS");
    expect(afterDuplicate.paidAt?.toISOString()).toBe(beforeDuplicate.paidAt?.toISOString());
  });

  it("webhook success after verify success does not duplicate update", async () => {
    const { orderId } = await createOrderFixture();
    const paymentService = new PaymentService(AppDataSource);
    const payment = await paymentService.createPendingPayment({ id: orderId });

    getMock.mockResolvedValueOnce({
      data: {
        status: true,
        message: "Verification successful",
        data: {
          status: "success",
          reference: payment.reference,
          amount: payment.amountKobo
        }
      }
    });

    const verifyResponse = await request(app).get(`/public/payments/paystack/verify?reference=${payment.reference}`);
    expect(verifyResponse.status).toBe(200);

    const paymentRepo = AppDataSource.getRepository(Payment);
    const beforeWebhook = await paymentRepo.findOneOrFail({ where: { id: payment.id } });

    const payload = {
      event: "charge.success",
      data: { reference: payment.reference }
    };

    const webhookResponse = await request(app)
      .post("/webhooks/paystack")
      .set("x-paystack-signature", makeWebhookSignature(payload))
      .set("Content-Type", "application/json")
      .send(JSON.stringify(payload));
    expect(webhookResponse.status).toBe(200);

    const afterWebhook = await paymentRepo.findOneOrFail({ where: { id: payment.id } });
    expect(afterWebhook.status).toBe("SUCCESS");
    expect(afterWebhook.paidAt?.toISOString()).toBe(beforeWebhook.paidAt?.toISOString());
  });

  it("webhook rejects invalid signature", async () => {
    const payload = {
      event: "charge.success",
      data: { reference: "fake-ref" }
    };

    const response = await request(app)
      .post("/webhooks/paystack")
      .set("x-paystack-signature", "invalid-signature")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(payload));

    expect([400, 401]).toContain(response.status);
  });
});
