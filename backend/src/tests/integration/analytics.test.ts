import request from "supertest";
import { createApp } from "../../app";
import { registerAndGetToken } from "../helpers/auth";
import { AppDataSource } from "../../config/data-source";
import { Order, OrderStatus } from "../../entities/Order";

const app = createApp();

const atUtcNoonDaysAgo = (daysAgo: number): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo, 12, 0, 0));
};

const createMenu = async (token: string, namePrefix: string) => {
  const categoryResponse = await request(app)
    .post("/categories")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: `${namePrefix} Category`, sortOrder: 0 });
  expect(categoryResponse.status).toBe(201);

  const categoryId = categoryResponse.body.category.id as number;
  const jollofResponse = await request(app)
    .post("/items")
    .set("Authorization", `Bearer ${token}`)
    .send({
      categoryId,
      name: `${namePrefix} Jollof`,
      description: "Rice",
      price: 2000,
      isAvailable: true
    });
  expect(jollofResponse.status).toBe(201);

  const chickenResponse = await request(app)
    .post("/items")
    .set("Authorization", `Bearer ${token}`)
    .send({
      categoryId,
      name: `${namePrefix} Chicken`,
      description: "Protein",
      price: 3000,
      isAvailable: true
    });
  expect(chickenResponse.status).toBe(201);

  return {
    itemAId: jollofResponse.body.item.id as number,
    itemAName: jollofResponse.body.item.name as string,
    itemBId: chickenResponse.body.item.id as number,
    itemBName: chickenResponse.body.item.name as string
  };
};

const createOrderWithItemsAndStatus = async (input: {
  slug: string;
  status: OrderStatus;
  createdAt: Date;
  items: Array<{ itemId: number; quantity: number }>;
}) => {
  const orderResponse = await request(app)
    .post(`/public/restaurants/${input.slug}/orders`)
    .send({
      type: "PICKUP",
      customerName: "Analytics Tester",
      customerPhone: "08010000000",
      customerEmail: "analytics@dishpatch.test",
      deliveryAddress: null,
      items: input.items
    });

  expect(orderResponse.status).toBe(201);
  const orderId = orderResponse.body.order.id as number;

  const orderRepo = AppDataSource.getRepository(Order);
  await orderRepo.query(`UPDATE "orders" SET "status" = $1, "createdAt" = $2, "updatedAt" = $2 WHERE "id" = $3`, [
    input.status,
    input.createdAt,
    orderId
  ]);

  return orderId;
};

describe("Analytics Endpoints", () => {
  it("returns 401 without auth token", async () => {
    const response = await request(app).get("/analytics/overview");
    expect(response.status).toBe(401);
  });

  it("enforces tenant isolation for analytics", async () => {
    const accountA = await registerAndGetToken(app, {
      restaurantName: "Analytics Tenant A",
      email: "analytics-a@dishpatch.test",
      password: "StrongPass123"
    });
    const accountB = await registerAndGetToken(app, {
      restaurantName: "Analytics Tenant B",
      email: "analytics-b@dishpatch.test",
      password: "StrongPass123"
    });

    const menuA = await createMenu(accountA.accessToken, "A");
    const menuB = await createMenu(accountB.accessToken, "B");

    await createOrderWithItemsAndStatus({
      slug: accountA.user.restaurant.slug,
      status: "ACCEPTED",
      createdAt: atUtcNoonDaysAgo(0),
      items: [{ itemId: menuA.itemAId, quantity: 1 }]
    });

    await createOrderWithItemsAndStatus({
      slug: accountB.user.restaurant.slug,
      status: "ACCEPTED",
      createdAt: atUtcNoonDaysAgo(0),
      items: [{ itemId: menuB.itemAId, quantity: 4 }]
    });

    const overviewResponse = await request(app)
      .get("/analytics/overview")
      .set("Authorization", `Bearer ${accountA.accessToken}`);
    expect(overviewResponse.status).toBe(200);
    expect(overviewResponse.body.kpis.totalOrders).toBe(1);
    expect(overviewResponse.body.kpis.totalRevenue).toBe("2000.00");

    const topItemsResponse = await request(app)
      .get("/analytics/top-items?range=7d&limit=5")
      .set("Authorization", `Bearer ${accountA.accessToken}`);
    expect(topItemsResponse.status).toBe(200);
    expect(topItemsResponse.body.items).toHaveLength(1);
    expect(topItemsResponse.body.items[0].name).toBe(menuA.itemAName);
    expect(topItemsResponse.body.items[0].quantity).toBe(1);
  });

  it("aggregates overview, timeseries, and top-items correctly", async () => {
    const account = await registerAndGetToken(app, {
      restaurantName: "Analytics Aggregation",
      email: "analytics-aggregation@dishpatch.test",
      password: "StrongPass123"
    });

    const menu = await createMenu(account.accessToken, "Agg");

    await createOrderWithItemsAndStatus({
      slug: account.user.restaurant.slug,
      status: "ACCEPTED",
      createdAt: atUtcNoonDaysAgo(0),
      items: [
        { itemId: menu.itemAId, quantity: 2 },
        { itemId: menu.itemBId, quantity: 1 }
      ]
    });

    await createOrderWithItemsAndStatus({
      slug: account.user.restaurant.slug,
      status: "COMPLETED",
      createdAt: atUtcNoonDaysAgo(2),
      items: [{ itemId: menu.itemAId, quantity: 1 }]
    });

    await createOrderWithItemsAndStatus({
      slug: account.user.restaurant.slug,
      status: "PENDING_TRANSFER",
      createdAt: atUtcNoonDaysAgo(0),
      items: [{ itemId: menu.itemBId, quantity: 4 }]
    });

    await createOrderWithItemsAndStatus({
      slug: account.user.restaurant.slug,
      status: "EXPIRED",
      createdAt: atUtcNoonDaysAgo(1),
      items: [{ itemId: menu.itemAId, quantity: 3 }]
    });

    const overviewResponse = await request(app)
      .get("/analytics/overview?range=7d")
      .set("Authorization", `Bearer ${account.accessToken}`);
    expect(overviewResponse.status).toBe(200);
    expect(overviewResponse.body.kpis).toEqual(
      expect.objectContaining({
        ordersToday: 2,
        revenueToday: "7000.00",
        ordersThisWeek: 4,
        revenueThisWeek: "9000.00",
        totalOrders: 4,
        totalRevenue: "9000.00",
        avgOrderValue: "4500.00",
        paidOrders: 2,
        pendingTransferOrders: 1,
        expiredOrders: 1
      })
    );

    const timeseriesResponse = await request(app)
      .get("/analytics/timeseries?range=7d")
      .set("Authorization", `Bearer ${account.accessToken}`);
    expect(timeseriesResponse.status).toBe(200);
    expect(timeseriesResponse.body.series).toHaveLength(7);

    const todayKey = atUtcNoonDaysAgo(0).toISOString().slice(0, 10);
    const twoDaysAgoKey = atUtcNoonDaysAgo(2).toISOString().slice(0, 10);
    const oneDayAgoKey = atUtcNoonDaysAgo(1).toISOString().slice(0, 10);
    const todaySeries = timeseriesResponse.body.series.find((entry: { date: string }) => entry.date === todayKey);
    const twoDaysAgoSeries = timeseriesResponse.body.series.find((entry: { date: string }) => entry.date === twoDaysAgoKey);
    const oneDayAgoSeries = timeseriesResponse.body.series.find((entry: { date: string }) => entry.date === oneDayAgoKey);
    const zeroDaySeries = timeseriesResponse.body.series.find((entry: { orders: number }) => entry.orders === 0);

    expect(todaySeries).toEqual(expect.objectContaining({ orders: 2, revenue: "7000.00" }));
    expect(twoDaysAgoSeries).toEqual(expect.objectContaining({ orders: 1, revenue: "2000.00" }));
    expect(oneDayAgoSeries).toEqual(expect.objectContaining({ orders: 1, revenue: "0.00" }));
    expect(zeroDaySeries).toBeTruthy();

    const topItemsResponse = await request(app)
      .get("/analytics/top-items?range=7d&limit=5")
      .set("Authorization", `Bearer ${account.accessToken}`);
    expect(topItemsResponse.status).toBe(200);
    expect(topItemsResponse.body.items).toHaveLength(2);
    expect(topItemsResponse.body.items[0]).toEqual(
      expect.objectContaining({
        name: menu.itemAName,
        quantity: 3,
        revenue: "6000.00"
      })
    );
    expect(topItemsResponse.body.items[1]).toEqual(
      expect.objectContaining({
        name: menu.itemBName,
        quantity: 1,
        revenue: "3000.00"
      })
    );
  });
});
