import request from "supertest";
import { createApp } from "../../app";
import { registerAndGetToken } from "../helpers/auth";

describe("Public Menu and Orders", () => {
  const app = createApp();

  it("returns public menu with only available items", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Public Menu Restaurant",
      email: "public-menu@dishpatch.test",
      password: "StrongPass123"
    });

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
    const returnedCategory = menuResponse.body.categories.find((c: { id: number }) => c.id === categoryId);
    expect(returnedCategory).toBeTruthy();
    expect(returnedCategory.items).toHaveLength(1);
    expect(returnedCategory.items[0].name).toBe("Available Rice");
  });

  it("creates pickup order successfully with correct total and pending status", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Pickup Orders Restaurant",
      email: "pickup-orders@dishpatch.test",
      password: "StrongPass123"
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
    expect(orderResponse.body.order.status).toBe("PENDING_PAYMENT");
    expect(orderResponse.body.order.type).toBe("PICKUP");
    expect(orderResponse.body.order.deliveryAddress).toBeNull();
    expect(orderResponse.body.order.totalAmount).toBe("6500.00");

    const ordersResponse = await request(app)
      .get("/orders")
      .set("Authorization", `Bearer ${auth.accessToken}`);
    expect(ordersResponse.status).toBe(200);
    expect(ordersResponse.body.orders).toHaveLength(1);
    expect(ordersResponse.body.orders[0].status).toBe("PENDING_PAYMENT");
    expect(ordersResponse.body.orders[0].totalAmount).toBe("6500.00");
  });

  it("creates delivery order successfully", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Delivery Orders Restaurant",
      email: "delivery-orders@dishpatch.test",
      password: "StrongPass123"
    });

    const category = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({ name: "Delivery Category", sortOrder: 0 });
    expect(category.status).toBe(201);

    const item = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({
        categoryId: category.body.category.id,
        name: "Amala",
        description: "Traditional",
        price: 1800,
        isAvailable: true
      });
    expect(item.status).toBe(201);

    const orderResponse = await request(app)
      .post(`/public/restaurants/${auth.user.restaurant.slug}/orders`)
      .send({
        type: "DELIVERY",
        customerName: "Kemi Lagos",
        customerPhone: "08040000000",
        deliveryAddress: "12 Marina Street, Lagos",
        items: [{ itemId: item.body.item.id, quantity: 2 }]
      });

    expect(orderResponse.status).toBe(201);
    expect(orderResponse.body.order.status).toBe("PENDING_PAYMENT");
    expect(orderResponse.body.order.type).toBe("DELIVERY");
    expect(orderResponse.body.order.deliveryAddress).toBe("12 Marina Street, Lagos");
    expect(orderResponse.body.order.totalAmount).toBe("3600.00");
  });

  it("fails delivery order creation without delivery address", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Delivery Validation Restaurant",
      email: "delivery-validation@dishpatch.test",
      password: "StrongPass123"
    });

    const category = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({ name: "Validation Category", sortOrder: 0 });
    expect(category.status).toBe(201);

    const item = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({
        categoryId: category.body.category.id,
        name: "Efo Riro",
        description: "Vegetable",
        price: 2200,
        isAvailable: true
      });
    expect(item.status).toBe(201);

    const orderResponse = await request(app)
      .post(`/public/restaurants/${auth.user.restaurant.slug}/orders`)
      .send({
        type: "DELIVERY",
        customerName: "No Address User",
        customerPhone: "08050000000",
        items: [{ itemId: item.body.item.id, quantity: 1 }]
      });

    expect(orderResponse.status).toBe(400);
  });

  it("fails when ordering item that does not belong to restaurant", async () => {
    const accountA = await registerAndGetToken(app, {
      restaurantName: "Orders Tenant A",
      email: "orders-a@dishpatch.test",
      password: "StrongPass123"
    });

    const accountB = await registerAndGetToken(app, {
      restaurantName: "Orders Tenant B",
      email: "orders-b@dishpatch.test",
      password: "StrongPass123"
    });

    const categoryA = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${accountA.accessToken}`)
      .send({ name: "A Category", sortOrder: 0 });
    expect(categoryA.status).toBe(201);

    const itemA = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${accountA.accessToken}`)
      .send({
        categoryId: categoryA.body.category.id,
        name: "A Item",
        description: "A",
        price: 999,
        isAvailable: true
      });
    expect(itemA.status).toBe(201);

    const orderResponse = await request(app)
      .post(`/public/restaurants/${accountB.user.restaurant.slug}/orders`)
      .send({
        type: "PICKUP",
        customerName: "Cross Tenant",
        customerPhone: "08060000000",
        deliveryAddress: null,
        items: [{ itemId: itemA.body.item.id, quantity: 1 }]
      });

    expect(orderResponse.status).toBe(400);
  });

  it("fails when ordering an unavailable item", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Unavailable Item Restaurant",
      email: "unavailable-item@dishpatch.test",
      password: "StrongPass123"
    });

    const category = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({ name: "Unavailable Category", sortOrder: 0 });
    expect(category.status).toBe(201);

    const item = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({
        categoryId: category.body.category.id,
        name: "Sold Out Meal",
        description: "Out of stock",
        price: 3000,
        isAvailable: false
      });
    expect(item.status).toBe(201);

    const orderResponse = await request(app)
      .post(`/public/restaurants/${auth.user.restaurant.slug}/orders`)
      .send({
        type: "PICKUP",
        customerName: "Unavailable Item Buyer",
        customerPhone: "08070000000",
        deliveryAddress: null,
        items: [{ itemId: item.body.item.id, quantity: 1 }]
      });

    expect(orderResponse.status).toBe(400);
  });
});
