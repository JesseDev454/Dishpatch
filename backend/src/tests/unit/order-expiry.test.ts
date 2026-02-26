import { selectOrdersForExpiry } from "../../utils/order-expiry";
import { Order } from "../../entities/Order";

const pendingOrder = (createdAt: Date): Pick<Order, "status" | "createdAt"> => ({
  status: "PENDING_TRANSFER",
  createdAt
});

describe("order expiry selection", () => {
  const now = new Date("2026-02-21T12:30:00.000Z");

  it("does not expire pending order younger than 30 minutes", () => {
    const orders = [pendingOrder(new Date("2026-02-21T12:01:00.000Z"))];
    const expirable = selectOrdersForExpiry(orders, now, 30);
    expect(expirable).toHaveLength(0);
  });

  it("expires pending order exactly at 30 minutes boundary", () => {
    const orders = [pendingOrder(new Date("2026-02-21T12:00:00.000Z"))];
    const expirable = selectOrdersForExpiry(orders, now, 30);
    expect(expirable).toHaveLength(1);
  });

  it("expires pending order older than 30 minutes", () => {
    const orders = [pendingOrder(new Date("2026-02-21T11:50:00.000Z"))];
    const expirable = selectOrdersForExpiry(orders, now, 30);
    expect(expirable).toHaveLength(1);
  });

  it("never expires non-pending orders", () => {
    const orders: Array<Pick<Order, "status" | "createdAt">> = [
      { status: "ACCEPTED", createdAt: new Date("2026-02-21T11:00:00.000Z") },
      { status: "CANCELLED", createdAt: new Date("2026-02-21T11:00:00.000Z") },
      { status: "COMPLETED", createdAt: new Date("2026-02-21T11:00:00.000Z") }
    ];
    const expirable = selectOrdersForExpiry(orders, now, 30);
    expect(expirable).toHaveLength(0);
  });
});
