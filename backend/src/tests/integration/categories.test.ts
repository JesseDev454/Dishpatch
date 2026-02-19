import request from "supertest";
import { createApp } from "../../app";
import { registerAndGetToken } from "../helpers/auth";

describe("Categories CRUD", () => {
  const app = createApp();

  it("creates, lists, updates and deletes a category", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Category House",
      email: "owner@categoryhouse.com",
      password: "StrongPass123"
    });

    const createResponse = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({ name: "Swallows", sortOrder: 2 });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.category.name).toBe("Swallows");

    const categoryId = createResponse.body.category.id as number;

    const listResponse = await request(app)
      .get("/categories")
      .set("Authorization", `Bearer ${auth.accessToken}`);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.categories).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: categoryId, name: "Swallows" })])
    );

    const updateResponse = await request(app)
      .patch(`/categories/${categoryId}`)
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({ name: "Updated Swallows" });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.category.name).toBe("Updated Swallows");

    const deleteResponse = await request(app)
      .delete(`/categories/${categoryId}`)
      .set("Authorization", `Bearer ${auth.accessToken}`);
    expect(deleteResponse.status).toBe(204);

    const finalList = await request(app)
      .get("/categories")
      .set("Authorization", `Bearer ${auth.accessToken}`);
    expect(finalList.status).toBe(200);
    expect(finalList.body.categories).toHaveLength(0);
  });

  it("fails validation when category name is missing", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Validation Kitchen",
      email: "owner@validationkitchen.com",
      password: "StrongPass123"
    });

    const response = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .send({ sortOrder: 0 });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Required");
  });
});
