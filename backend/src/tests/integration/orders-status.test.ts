import request from "supertest";
import { createApp } from "../../app";
import { registerAndGetToken } from "../helpers/auth";
import { AppDataSource } from "../../config/data-source";
import { Order } from "../../entities/Order";
import * as realtimeEmitter from "../../realtime/realtime-emitter";

describe("Order Transfer Workflow", () => {
  const app = createApp();
  const emitOrderUpdatedSpy = jest.spyOn(realtimeEmitter, "emitOrderUpdated");

  beforeEach(() => {
    emitOrderUpdatedSpy.mockClear();
  });

  const createPendingTransferOrder = async (token: string, slug: string) => {
    const category = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Order Workflow Category", sortOrder: 1 });
    expect(category.status).toBe(201);

    const item = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${token}`)
      .send({
        categoryId: category.body.category.id,
        name: "Order Workflow Item",
        description: "For workflow tests",
        price: 3200,
        isAvailable: true
      });
    expect(item.status).toBe(201);

    const orderResponse = await request(app)
      .post(`/public/restaurants/${slug}/orders`)
      .send({
        type: "PICKUP",
        customerName: "Workflow User",
        customerPhone: "08010000000",
        customerEmail: "workflow@dishpatch.test",
        deliveryAddress: null,
        items: [{ itemId: item.body.item.id, quantity: 1 }]
      });
    expect(orderResponse.status).toBe(201);

    return orderResponse.body.order.id as number;
  };

  it("cannot confirm transfer for order that belongs to another restaurant", async () => {
    const restaurantA = await registerAndGetToken(app, {
      restaurantName: "Workflow Tenant A",
      email: "workflow-a@dishpatch.test",
      password: "StrongPass123"
    });
    const restaurantB = await registerAndGetToken(app, {
      restaurantName: "Workflow Tenant B",
      email: "workflow-b@dishpatch.test",
      password: "StrongPass123"
    });

    const orderId = await createPendingTransferOrder(restaurantA.accessToken, restaurantA.user.restaurant.slug);
    await request(app).post(`/public/orders/${orderId}/mark-paid`);

    const response = await request(app)
      .patch(`/orders/${orderId}/confirm-transfer`)
      .set("Authorization", `Bearer ${restaurantB.accessToken}`);

    expect([403, 404]).toContain(response.status);
  });

  it("rejects confirming transfer before customer marks paid", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Workflow Pending Validation",
      email: "workflow-pending@dishpatch.test",
      password: "StrongPass123"
    });

    const orderId = await createPendingTransferOrder(auth.accessToken, auth.user.restaurant.slug);
    const response = await request(app)
      .patch(`/orders/${orderId}/confirm-transfer`)
      .set("Authorization", `Bearer ${auth.accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Customer has not marked");
  });

  it("confirms transfer and supports ACCEPTED -> COMPLETED transition", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Workflow Valid Transitions",
      email: "workflow-valid@dishpatch.test",
      password: "StrongPass123"
    });

    const orderId = await createPendingTransferOrder(auth.accessToken, auth.user.restaurant.slug);
    const markPaid = await request(app).post(`/public/orders/${orderId}/mark-paid`);
    expect(markPaid.status).toBe(200);

    const accepted = await request(app)
      .patch(`/orders/${orderId}/confirm-transfer`)
      .set("Authorization", `Bearer ${auth.accessToken}`);
    expect(accepted.status).toBe(200);
    expect(accepted.body.order.status).toBe("ACCEPTED");

    const completed = await request(app)
      .patch(`/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({ status: "COMPLETED" });
    expect(completed.status).toBe(200);
    expect(completed.body.order.status).toBe("COMPLETED");
  });

  it("rejects transfer notification and moves order to CANCELLED", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Workflow Reject Restaurant",
      email: "workflow-reject@dishpatch.test",
      password: "StrongPass123"
    });

    const orderId = await createPendingTransferOrder(auth.accessToken, auth.user.restaurant.slug);
    await request(app).post(`/public/orders/${orderId}/mark-paid`);

    const rejected = await request(app)
      .patch(`/orders/${orderId}/reject-transfer`)
      .set("Authorization", `Bearer ${auth.accessToken}`);

    expect(rejected.status).toBe(200);
    expect(rejected.body.order.status).toBe("CANCELLED");
  });

  it("emits order:updated payload when confirm-transfer succeeds", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Workflow Emitter Restaurant",
      email: "workflow-emitter@dishpatch.test",
      password: "StrongPass123"
    });

    const orderId = await createPendingTransferOrder(auth.accessToken, auth.user.restaurant.slug);
    await request(app).post(`/public/orders/${orderId}/mark-paid`);

    const response = await request(app)
      .patch(`/orders/${orderId}/confirm-transfer`)
      .set("Authorization", `Bearer ${auth.accessToken}`);

    expect(response.status).toBe(200);
    expect(emitOrderUpdatedSpy).toHaveBeenCalled();
    expect(emitOrderUpdatedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: orderId,
        restaurantId: auth.user.restaurant.id,
        status: "ACCEPTED"
      })
    );
  });

  it("keeps tenant-safe status updates via /orders/:id/status", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Workflow Status Endpoint",
      email: "workflow-status@dishpatch.test",
      password: "StrongPass123"
    });

    const orderId = await createPendingTransferOrder(auth.accessToken, auth.user.restaurant.slug);
    await request(app).post(`/public/orders/${orderId}/mark-paid`);
    await request(app).patch(`/orders/${orderId}/confirm-transfer`).set("Authorization", `Bearer ${auth.accessToken}`);

    const cancel = await request(app)
      .patch(`/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({ status: "CANCELLED" });
    expect(cancel.status).toBe(200);
    expect(cancel.body.order.status).toBe("CANCELLED");

    const orderRepo = AppDataSource.getRepository(Order);
    const persisted = await orderRepo.findOneOrFail({ where: { id: orderId } });
    expect(persisted.status).toBe("CANCELLED");
  });
});
