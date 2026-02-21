import request from "supertest";
import { createApp } from "../../app";
import { registerAndGetToken } from "../helpers/auth";
import { PaymentService } from "../../services/payment.service";
import { AppDataSource } from "../../config/data-source";
import { Payment } from "../../entities/Payment";
import { Order } from "../../entities/Order";

describe("Public Receipts", () => {
  const app = createApp();
  const paymentService = new PaymentService(AppDataSource);

  const createReceiptFixture = async (
    paymentStatus: "SUCCESS" | "FAILED" | "PENDING" = "SUCCESS",
    seed = "a",
    orderStatusAfterPayment?: Order["status"]
  ) => {
    const auth = await registerAndGetToken(app, {
      restaurantName: `Receipt Restaurant ${seed}`,
      email: `receipts-${seed}@dishpatch.test`,
      password: "StrongPass123"
    });

    const categoryResponse = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({ name: `Meals ${seed}`, sortOrder: 0 });
    expect(categoryResponse.status).toBe(201);

    const itemResponse = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({
        categoryId: categoryResponse.body.category.id,
        name: `Jollof ${seed}`,
        description: "Receipt item",
        price: 3200,
        isAvailable: true
      });
    expect(itemResponse.status).toBe(201);

    const orderResponse = await request(app)
      .post(`/public/restaurants/${auth.user.restaurant.slug}/orders`)
      .send({
        type: "PICKUP",
        customerName: "Receipt Customer",
        customerPhone: "08010000000",
        customerEmail: `customer-${seed}@dishpatch.test`,
        deliveryAddress: null,
        items: [{ itemId: itemResponse.body.item.id, quantity: 2 }]
      });
    expect(orderResponse.status).toBe(201);

    const orderId = orderResponse.body.order.id as number;
    const pendingPayment = await paymentService.createPendingPayment({ id: orderId });

    if (paymentStatus === "SUCCESS") {
      await paymentService.markPaymentSuccess(pendingPayment.reference, {
        event: "charge.success",
        data: { reference: pendingPayment.reference }
      });
    } else if (paymentStatus === "FAILED") {
      await paymentService.markPaymentFailed(pendingPayment.reference);
    }


    if (orderStatusAfterPayment) {
      const orderRepo = AppDataSource.getRepository(Order);
      const order = await orderRepo.findOneOrFail({ where: { id: orderId } });
      order.status = orderStatusAfterPayment;
      await orderRepo.save(order);
    }

    const paymentRepo = AppDataSource.getRepository(Payment);
    const payment = await paymentRepo.findOneOrFail({ where: { id: pendingPayment.id } });

    return { auth, orderId, payment };
  };

  it("returns receipt data for valid SUCCESS payment", async () => {
    const { orderId, payment } = await createReceiptFixture("SUCCESS", "success");

    const response = await request(app).get(`/public/receipts/${payment.reference}`);
    expect(response.status).toBe(200);
    expect(response.body.order.id).toBe(orderId);
    expect(response.body.order.totalAmount).toBe("6400.00");
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].nameSnapshot).toBe("Jollof success");
    expect(response.body.payment.reference).toBe(payment.reference);
    expect(response.body.payment.amountKobo).toBe(640000);
    expect(response.body.payment.paidAt).toBeTruthy();
  });

  it("returns 404 for invalid reference", async () => {
    const response = await request(app).get("/public/receipts/not_a_real_reference");
    expect(response.status).toBe(404);
  });

  it("returns 400 for FAILED payment reference", async () => {
    const { payment } = await createReceiptFixture("FAILED", "failed");

    const response = await request(app).get(`/public/receipts/${payment.reference}`);
    expect(response.status).toBe(400);
  });

  it("returns 400 for PENDING payment reference", async () => {
    const { payment } = await createReceiptFixture("PENDING", "pending");

    const response = await request(app).get(`/public/receipts/${payment.reference}`);
    expect(response.status).toBe(400);
  });

  it("returns 200 for SUCCESS payment when order status is ACCEPTED", async () => {
    const { payment } = await createReceiptFixture("SUCCESS", "accepted", "ACCEPTED");

    const response = await request(app).get(`/public/receipts/${payment.reference}`);
    expect(response.status).toBe(200);
  });

  it("returns 200 for SUCCESS payment when order status is COMPLETED", async () => {
    const { payment } = await createReceiptFixture("SUCCESS", "completed", "COMPLETED");

    const response = await request(app).get(`/public/receipts/${payment.reference}`);
    expect(response.status).toBe(200);
  });

  it("returns 400 for SUCCESS payment when order status is PENDING_PAYMENT", async () => {
    const { payment } = await createReceiptFixture("SUCCESS", "pending-order", "PENDING_PAYMENT");

    const response = await request(app).get(`/public/receipts/${payment.reference}`);
    expect(response.status).toBe(400);
  });

  it("returns 400 for SUCCESS payment when order status is EXPIRED", async () => {
    const { payment } = await createReceiptFixture("SUCCESS", "expired-order", "EXPIRED");

    const response = await request(app).get(`/public/receipts/${payment.reference}`);
    expect(response.status).toBe(400);
  });

  it("returns receipt tied to correct restaurant and order", async () => {
    const fixtureA = await createReceiptFixture("SUCCESS", "tenant-a");
    const fixtureB = await createReceiptFixture("SUCCESS", "tenant-b");

    const response = await request(app).get(`/public/receipts/${fixtureA.payment.reference}`);
    expect(response.status).toBe(200);
    expect(response.body.order.id).toBe(fixtureA.orderId);
    expect(response.body.restaurant.name).toBe("Receipt Restaurant tenant-a");
    expect(response.body.order.id).not.toBe(fixtureB.orderId);
    expect(response.body.restaurant.name).not.toBe("Receipt Restaurant tenant-b");
  });
});
