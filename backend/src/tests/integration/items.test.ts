import request from "supertest";
import { createApp } from "../../app";
import { registerAndGetToken } from "../helpers/auth";

describe("Items CRUD", () => {
  const app = createApp();

  it("creates, lists, updates, toggles availability, and deletes an item", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Items Hub",
      email: "owner@itemshub.com",
      password: "StrongPass123"
    });

    const categoryResponse = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({ name: "Rice Dishes", sortOrder: 1 });
    expect(categoryResponse.status).toBe(201);

    const categoryId = categoryResponse.body.category.id as number;

    const createItemResponse = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({
        categoryId,
        name: "Party Jollof",
        description: "Smoky and rich",
        price: 4200,
        isAvailable: true
      });
    expect(createItemResponse.status).toBe(201);
    expect(createItemResponse.body.item.name).toBe("Party Jollof");

    const itemId = createItemResponse.body.item.id as number;

    const listResponse = await request(app)
      .get("/items")
      .set("Authorization", `Bearer ${auth.accessToken}`);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: itemId, name: "Party Jollof" })])
    );

    const updatePriceResponse = await request(app)
      .patch(`/items/${itemId}`)
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({ price: 5000 });
    expect(updatePriceResponse.status).toBe(200);
    expect(updatePriceResponse.body.item.price).toBe("5000.00");

    const toggleAvailabilityResponse = await request(app)
      .patch(`/items/${itemId}`)
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({ isAvailable: false });
    expect(toggleAvailabilityResponse.status).toBe(200);
    expect(toggleAvailabilityResponse.body.item.isAvailable).toBe(false);

    const deleteResponse = await request(app)
      .delete(`/items/${itemId}`)
      .set("Authorization", `Bearer ${auth.accessToken}`);
    expect(deleteResponse.status).toBe(204);

    const finalList = await request(app)
      .get("/items")
      .set("Authorization", `Bearer ${auth.accessToken}`);
    expect(finalList.status).toBe(200);
    expect(finalList.body.items).toHaveLength(0);
  });

  it("fails validation when item price is negative", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Price Guard",
      email: "owner@priceguard.com",
      password: "StrongPass123"
    });

    const categoryResponse = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({ name: "Soups", sortOrder: 0 });
    expect(categoryResponse.status).toBe(201);

    const response = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({
        categoryId: categoryResponse.body.category.id,
        name: "Egusi Soup",
        price: -100,
        isAvailable: true
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Price must be >= 0");
  });
});
