import request from "supertest";
import { createApp } from "../../app";
import { registerAndGetToken } from "../helpers/auth";

describe("Public Menu and Transfer Orders", () => {
  const app = createApp();

  it("returns public menu with available items and bank details", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Public Menu Restaurant",
      email: "public-menu@dishpatch.test",
      password: "StrongPass123"
    });

    const bankDetails = await request(app)
      .patch("/auth/bank-details")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({
        bankName: "Moniepoint",
        accountNumber: "1234567890",
        accountName: "Public Menu Restaurant",
        bankInstructions: "Transfer exact amount and tap I've Paid."
      });
    expect(bankDetails.status).toBe(200);

    const category = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({ name: "Main Meals", sortOrder: 0 });
    expect(category.status).toBe(201);

    const categoryId = category.body.category.id as number;

    const availableItem = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({
        categoryId,
        name: "Available Rice",
        description: "Shown publicly",
        price: 2000,
        isAvailable: true
      });
    expect(availableItem.status).toBe(201);

    const unavailableItem = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({
        categoryId,
        name: "Hidden Rice",
        description: "Should not be shown",
        price: 2400,
        isAvailable: false
      });
    expect(unavailableItem.status).toBe(201);

    const menuResponse = await request(app).get(`/public/restaurants/${auth.user.restaurant.slug}/menu`);

    expect(menuResponse.status).toBe(200);
    expect(menuResponse.body.restaurant.bankName).toBe("Moniepoint");
    expect(menuResponse.body.restaurant.accountNumber).toBe("1234567890");
    const returnedCategory = menuResponse.body.categories.find((c: { id: number }) => c.id === categoryId);
    expect(returnedCategory).toBeTruthy();
    expect(returnedCategory.items).toHaveLength(1);
    expect(returnedCategory.items[0].name).toBe("Available Rice");
  });

  it("creates pickup order with default PENDING_TRANSFER status", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Pickup Orders Restaurant",
      email: "pickup-orders@dishpatch.test",
      password: "StrongPass123"
    });

    await request(app)
      .patch("/auth/bank-details")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({
        bankName: "Opay",
        accountNumber: "0987654321",
        accountName: "Pickup Orders Restaurant",
        bankInstructions: "Use order ID as transfer narration."
      });

    const category = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({ name: "Pickup Category", sortOrder: 0 });
    expect(category.status).toBe(201);
    const categoryId = category.body.category.id as number;

    const itemOne = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({
        categoryId,
        name: "Fried Rice",
        description: "Yummy",
        price: 2500,
        isAvailable: true
      });
    expect(itemOne.status).toBe(201);

    const itemTwo = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({
        categoryId,
        name: "Chicken",
        description: "Protein",
        price: 1500,
        isAvailable: true
      });
    expect(itemTwo.status).toBe(201);

    const orderResponse = await request(app)
      .post(`/public/restaurants/${auth.user.restaurant.slug}/orders`)
      .send({
        type: "PICKUP",
        customerName: "Ada Obi",
        customerPhone: "08030000000",
        deliveryAddress: null,
        items: [
          { itemId: itemOne.body.item.id, quantity: 2 },
          { itemId: itemTwo.body.item.id, quantity: 1 }
        ]
      });

    expect(orderResponse.status).toBe(201);
    expect(orderResponse.body.order.status).toBe("PENDING_TRANSFER");
    expect(orderResponse.body.order.type).toBe("PICKUP");
    expect(orderResponse.body.order.deliveryAddress).toBeNull();
    expect(orderResponse.body.order.totalAmount).toBe("6500.00");
    expect(orderResponse.body.transferDetails).toEqual(
      expect.objectContaining({
        bankName: "Opay",
        accountNumber: "0987654321",
        accountName: "Pickup Orders Restaurant"
      })
    );
  });

  it("marks order paid from customer notification endpoint", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Mark Paid Restaurant",
      email: "mark-paid@dishpatch.test",
      password: "StrongPass123"
    });

    const category = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({ name: "Transfer Meals", sortOrder: 0 });
    expect(category.status).toBe(201);

    const item = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({
        categoryId: category.body.category.id,
        name: "Jollof",
        description: null,
        price: 3200,
        isAvailable: true
      });
    expect(item.status).toBe(201);

    const orderResponse = await request(app)
      .post(`/public/restaurants/${auth.user.restaurant.slug}/orders`)
      .send({
        type: "PICKUP",
        customerName: "Transfer Customer",
        customerPhone: "08033333333",
        deliveryAddress: null,
        items: [{ itemId: item.body.item.id, quantity: 1 }]
      });
    expect(orderResponse.status).toBe(201);

    const markPaid = await request(app).post(`/public/orders/${orderResponse.body.order.id}/mark-paid`);
    expect(markPaid.status).toBe(200);
    expect(markPaid.body.order.status).toBe("PENDING_TRANSFER");
    expect(markPaid.body.order.customerMarkedPaidAt).toBeTruthy();
  });
});
