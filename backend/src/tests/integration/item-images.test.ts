import request from "supertest";
import { createApp } from "../../app";
import { registerAndGetToken } from "../helpers/auth";
import { ImageUploadService } from "../../services/image-upload.service";

const IMAGE_URL = "https://example.cdn.com/dishpatch/item.jpg";

describe("Item image upload", () => {
  const app = createApp();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createCategoryAndItem = async (accessToken: string) => {
    const categoryResponse = await request(app)
      .post("/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Rice", sortOrder: 1 });
    expect(categoryResponse.status).toBe(201);

    const itemResponse = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        categoryId: categoryResponse.body.category.id,
        name: "Jollof Rice",
        description: "Smoky and rich",
        price: 3200,
        isAvailable: true
      });
    expect(itemResponse.status).toBe(201);

    return {
      categoryId: categoryResponse.body.category.id as number,
      itemId: itemResponse.body.item.id as number
    };
  };

  it("requires auth for item image upload", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Image Auth",
      email: "owner@imageauth.com",
      password: "StrongPass123"
    });

    const { itemId } = await createCategoryAndItem(auth.accessToken);

    const response = await request(app)
      .post(`/items/${itemId}/image`)
      .attach("image", Buffer.from("fake-image-content"), {
        filename: "item.jpg",
        contentType: "image/jpeg"
      });

    expect(response.status).toBe(401);
  });

  it("enforces tenant isolation on image upload", async () => {
    const restaurantA = await registerAndGetToken(app, {
      restaurantName: "Tenant A",
      email: "owner@tenanta.com",
      password: "StrongPass123"
    });
    const restaurantB = await registerAndGetToken(app, {
      restaurantName: "Tenant B",
      email: "owner@tenantb.com",
      password: "StrongPass123"
    });

    const { itemId } = await createCategoryAndItem(restaurantA.accessToken);

    const uploadSpy = jest.spyOn(ImageUploadService.prototype, "uploadItemImage").mockResolvedValue({
      secureUrl: IMAGE_URL,
      publicId: "tenant-b-should-not-upload"
    });

    const response = await request(app)
      .post(`/items/${itemId}/image`)
      .set("Authorization", `Bearer ${restaurantB.accessToken}`)
      .attach("image", Buffer.from("fake-image-content"), {
        filename: "item.jpg",
        contentType: "image/jpeg"
      });

    expect(response.status).toBe(404);
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("uploads an image and persists imageUrl on item", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Image Save",
      email: "owner@imagesave.com",
      password: "StrongPass123"
    });

    const { itemId } = await createCategoryAndItem(auth.accessToken);

    const uploadSpy = jest.spyOn(ImageUploadService.prototype, "uploadItemImage").mockResolvedValue({
      secureUrl: IMAGE_URL,
      publicId: "dishpatch/uploaded-item"
    });

    const uploadResponse = await request(app)
      .post(`/items/${itemId}/image`)
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .attach("image", Buffer.from("fake-image-content"), {
        filename: "item.jpg",
        contentType: "image/jpeg"
      });

    expect(uploadResponse.status).toBe(200);
    expect(uploadResponse.body.item.imageUrl).toBe(IMAGE_URL);
    expect(uploadSpy).toHaveBeenCalledTimes(1);

    const itemsResponse = await request(app)
      .get("/items")
      .set("Authorization", `Bearer ${auth.accessToken}`);

    expect(itemsResponse.status).toBe(200);
    expect(itemsResponse.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: itemId, imageUrl: IMAGE_URL })])
    );
  });

  it("returns item imageUrl in public menu response", async () => {
    const auth = await registerAndGetToken(app, {
      restaurantName: "Image Public Menu",
      email: "owner@imagepublic.com",
      password: "StrongPass123"
    });

    const { itemId } = await createCategoryAndItem(auth.accessToken);

    jest.spyOn(ImageUploadService.prototype, "uploadItemImage").mockResolvedValue({
      secureUrl: IMAGE_URL,
      publicId: "dishpatch/public-item"
    });

    const uploadResponse = await request(app)
      .post(`/items/${itemId}/image`)
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .attach("image", Buffer.from("fake-image-content"), {
        filename: "item.jpg",
        contentType: "image/jpeg"
      });
    expect(uploadResponse.status).toBe(200);

    const menuResponse = await request(app).get(`/public/restaurants/${auth.user.restaurant.slug}/menu`);
    expect(menuResponse.status).toBe(200);

    const firstCategory = menuResponse.body.categories[0];
    expect(firstCategory.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: itemId, imageUrl: IMAGE_URL })])
    );
  });
});
