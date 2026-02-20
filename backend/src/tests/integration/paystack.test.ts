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

  it("webhook validates signature and marks payment success", async () => {
    const { orderId } = await createOrderFixture();
    const paymentService = new PaymentService(AppDataSource);
    const payment = await paymentService.createPendingPayment({ id: orderId });

    const payload = {
      event: "charge.success",
      data: { reference: payment.reference }
    };

    const raw = JSON.stringify(payload);
    const signature = crypto.createHmac("sha512", env.paystack.secretKey).update(raw).digest("hex");

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
