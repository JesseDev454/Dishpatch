import request from "supertest";
import { createApp } from "../../app";
import { registerAndGetToken } from "../helpers/auth";

describe("Tenant Isolation", () => {
  const app = createApp();

  it("keeps category and item data isolated between restaurants", async () => {
    const accountA = await registerAndGetToken(app, {
      restaurantName: "Tenant A",
      email: "admin-a@dishpatch.test",
      password: "StrongPass123"
    });

    const accountB = await registerAndGetToken(app, {
      restaurantName: "Tenant B",
      email: "admin-b@dishpatch.test",
      password: "StrongPass123"
    });

    const categoryCreate = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${accountA.accessToken}`)
      .send({ name: "A Specials", sortOrder: 1 });

    expect(categoryCreate.status).toBe(201);
    const categoryId = categoryCreate.body.category.id as number;

    const itemCreate = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${accountA.accessToken}`)
      .send({
        categoryId,
        name: "A Jollof",
        description: "Spicy",
        price: 3200,
        isAvailable: true
      });

    expect(itemCreate.status).toBe(201);
    const itemId = itemCreate.body.item.id as number;

    const categoriesForB = await request(app)
      .get("/categories")
      .set("Authorization", `Bearer ${accountB.accessToken}`);
    expect(categoriesForB.status).toBe(200);
    expect(categoriesForB.body.categories).toHaveLength(0);

    const itemsForB = await request(app)
      .get("/items")
      .set("Authorization", `Bearer ${accountB.accessToken}`);
    expect(itemsForB.status).toBe(200);
    expect(itemsForB.body.items).toHaveLength(0);

    const patchCategoryAsB = await request(app)
      .patch(`/categories/${categoryId}`)
      .set("Authorization", `Bearer ${accountB.accessToken}`)
      .send({ name: "Hacked Name" });
    expect([403, 404]).toContain(patchCategoryAsB.status);

    const deleteCategoryAsB = await request(app)
      .delete(`/categories/${categoryId}`)
      .set("Authorization", `Bearer ${accountB.accessToken}`);
    expect([403, 404]).toContain(deleteCategoryAsB.status);

    const patchItemAsB = await request(app)
      .patch(`/items/${itemId}`)
      .set("Authorization", `Bearer ${accountB.accessToken}`)
      .send({ name: "Hacked Item" });
    expect([403, 404]).toContain(patchItemAsB.status);

    const deleteItemAsB = await request(app)
      .delete(`/items/${itemId}`)
      .set("Authorization", `Bearer ${accountB.accessToken}`);
    expect([403, 404]).toContain(deleteItemAsB.status);
  });

  it("prevents cross-tenant categoryId injection during item create and update", async () => {
    const accountA = await registerAndGetToken(app, {
      restaurantName: "Tenant A Injection",
      email: "admin-a-injection@dishpatch.test",
      password: "StrongPass123"
    });

    const accountB = await registerAndGetToken(app, {
      restaurantName: "Tenant B Injection",
      email: "admin-b-injection@dishpatch.test",
      password: "StrongPass123"
    });

    const categoryA = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${accountA.accessToken}`)
      .send({ name: "A Secret Category", sortOrder: 0 });
    expect(categoryA.status).toBe(201);

    const categoryB = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${accountB.accessToken}`)
      .send({ name: "B Own Category", sortOrder: 0 });
    expect(categoryB.status).toBe(201);

    const createAsBUsingA = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${accountB.accessToken}`)
      .send({
        categoryId: categoryA.body.category.id,
        name: "Injected Item",
        description: "Should fail",
        price: 1500,
        isAvailable: true
      });

    expect([400, 403, 404]).toContain(createAsBUsingA.status);

    const ownItemB = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${accountB.accessToken}`)
      .send({
        categoryId: categoryB.body.category.id,
        name: "B Item",
        description: "Own item",
        price: 1700,
        isAvailable: true
      });
    expect(ownItemB.status).toBe(201);

    const updateAsBUsingA = await request(app)
      .patch(`/items/${ownItemB.body.item.id}`)
      .set("Authorization", `Bearer ${accountB.accessToken}`)
      .send({ categoryId: categoryA.body.category.id });

    expect([400, 403, 404]).toContain(updateAsBUsingA.status);
  });

  it("allows own category update and delete for the same restaurant", async () => {
    const accountA = await registerAndGetToken(app, {
      restaurantName: "Tenant A Own CRUD",
      email: "admin-a-owncrud@dishpatch.test",
      password: "StrongPass123"
    });

    const createCategory = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${accountA.accessToken}`)
      .send({ name: "Initial Category", sortOrder: 5 });
    expect(createCategory.status).toBe(201);

    const categoryId = createCategory.body.category.id as number;

    const updateCategory = await request(app)
      .patch(`/categories/${categoryId}`)
      .set("Authorization", `Bearer ${accountA.accessToken}`)
      .send({ name: "Updated Category Name" });
    expect(updateCategory.status).toBe(200);
    expect(updateCategory.body.category.name).toBe("Updated Category Name");

    const deleteCategory = await request(app)
      .delete(`/categories/${categoryId}`)
      .set("Authorization", `Bearer ${accountA.accessToken}`);
    expect(deleteCategory.status).toBe(204);
  });
});
