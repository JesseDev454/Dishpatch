import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { Order } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import { requireAuth } from "../middleware/auth";
import {
  REVENUE_ORDER_STATUSES,
  getAnalyticsWindow,
  resolveAnalyticsRange,
  toMoneyString
} from "../utils/analytics";

const router = Router();

router.use(requireAuth);

const rangeQuerySchema = z.object({
  range: z.enum(["7d", "30d"]).optional()
});

const topItemsQuerySchema = z.object({
  range: z.enum(["7d", "30d"]).optional(),
  limit: z.coerce.number().int().positive().max(20).optional()
});

router.get("/overview", async (req, res, next) => {
  try {
    const parsed = rangeQuerySchema.parse(req.query);
    const range = resolveAnalyticsRange(parsed.range);
    const { rangeStart, rangeEnd, todayStart } = getAnalyticsWindow(range);
    const restaurantId = req.authUser!.restaurantId;

    const orderRepo = AppDataSource.getRepository(Order);
    const raw = await orderRepo
      .createQueryBuilder("o")
      .select("COUNT(*)", "totalOrders")
      .addSelect(
        "COALESCE(SUM(CASE WHEN o.status IN (:...revenueStatuses) THEN o.totalAmount ELSE 0 END), 0)",
        "totalRevenue"
      )
      .addSelect(
        "COALESCE(AVG(CASE WHEN o.status IN (:...revenueStatuses) THEN o.totalAmount END), 0)",
        "avgOrderValue"
      )
      .addSelect("COALESCE(SUM(CASE WHEN o.status IN (:...revenueStatuses) THEN 1 ELSE 0 END), 0)", "paidOrders")
      .addSelect(
        "COALESCE(SUM(CASE WHEN o.status = :pendingStatus THEN 1 ELSE 0 END), 0)",
        "pendingPaymentOrders"
      )
      .addSelect("COALESCE(SUM(CASE WHEN o.status = :expiredStatus THEN 1 ELSE 0 END), 0)", "expiredOrders")
      .addSelect(
        "COALESCE(SUM(CASE WHEN o.createdAt >= :todayStart AND o.createdAt < :rangeEnd THEN 1 ELSE 0 END), 0)",
        "ordersToday"
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN o.createdAt >= :todayStart AND o.createdAt < :rangeEnd AND o.status IN (:...revenueStatuses) THEN o.totalAmount ELSE 0 END), 0)",
        "revenueToday"
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN o.createdAt >= :rangeStart AND o.createdAt < :rangeEnd THEN 1 ELSE 0 END), 0)",
        "ordersInRange"
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN o.createdAt >= :rangeStart AND o.createdAt < :rangeEnd AND o.status IN (:...revenueStatuses) THEN o.totalAmount ELSE 0 END), 0)",
        "revenueInRange"
      )
      .where("o.restaurantId = :restaurantId", { restaurantId })
      .setParameters({
        revenueStatuses: REVENUE_ORDER_STATUSES,
        pendingStatus: "PENDING_PAYMENT",
        expiredStatus: "EXPIRED",
        todayStart: todayStart.toISOString(),
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString()
      })
      .getRawOne<{
        ordersToday: string | number;
        revenueToday: string | number;
        ordersInRange: string | number;
        revenueInRange: string | number;
        totalOrders: string | number;
        totalRevenue: string | number;
        avgOrderValue: string | number;
        paidOrders: string | number;
        pendingPaymentOrders: string | number;
        expiredOrders: string | number;
      }>();

    res.json({
      range,
      kpis: {
        ordersToday: Number(raw?.ordersToday ?? 0),
        revenueToday: toMoneyString(raw?.revenueToday),
        ordersThisWeek: Number(raw?.ordersInRange ?? 0),
        revenueThisWeek: toMoneyString(raw?.revenueInRange),
        totalOrders: Number(raw?.totalOrders ?? 0),
        totalRevenue: toMoneyString(raw?.totalRevenue),
        avgOrderValue: toMoneyString(raw?.avgOrderValue),
        paidOrders: Number(raw?.paidOrders ?? 0),
        pendingPaymentOrders: Number(raw?.pendingPaymentOrders ?? 0),
        expiredOrders: Number(raw?.expiredOrders ?? 0)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/timeseries", async (req, res, next) => {
  try {
    const parsed = rangeQuerySchema.parse(req.query);
    const range = resolveAnalyticsRange(parsed.range);
    const { days, rangeStart, rangeEnd } = getAnalyticsWindow(range);
    const restaurantId = req.authUser!.restaurantId;

    const orderRepo = AppDataSource.getRepository(Order);
    const rawRows = await orderRepo
      .createQueryBuilder("o")
      .select("TO_CHAR((o.createdAt AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')", "date")
      .addSelect("COUNT(*)", "orders")
      .addSelect(
        "COALESCE(SUM(CASE WHEN o.status IN (:...revenueStatuses) THEN o.totalAmount ELSE 0 END), 0)",
        "revenue"
      )
      .where("o.restaurantId = :restaurantId", { restaurantId })
      .andWhere("o.createdAt >= :rangeStart", { rangeStart: rangeStart.toISOString() })
      .andWhere("o.createdAt < :rangeEnd", { rangeEnd: rangeEnd.toISOString() })
      .setParameters({ revenueStatuses: REVENUE_ORDER_STATUSES })
      .groupBy("(o.createdAt AT TIME ZONE 'UTC')::date")
      .orderBy("(o.createdAt AT TIME ZONE 'UTC')::date", "ASC")
      .getRawMany<{ date: string; orders: string | number; revenue: string | number }>();

    const rowByDate = new Map(rawRows.map((row) => [row.date, row]));
    const series = Array.from({ length: days }, (_, offset) => {
      const date = new Date(rangeStart);
      date.setUTCDate(rangeStart.getUTCDate() + offset);
      const dateKey = date.toISOString().slice(0, 10);
      const row = rowByDate.get(dateKey);

      return {
        date: dateKey,
        orders: Number(row?.orders ?? 0),
        revenue: toMoneyString(row?.revenue)
      };
    });

    res.json({
      range,
      series
    });
  } catch (error) {
    next(error);
  }
});

router.get("/top-items", async (req, res, next) => {
  try {
    const parsed = topItemsQuerySchema.parse(req.query);
    const range = resolveAnalyticsRange(parsed.range);
    const limit = parsed.limit ?? 5;
    const { rangeStart, rangeEnd } = getAnalyticsWindow(range);
    const restaurantId = req.authUser!.restaurantId;

    const orderItemRepo = AppDataSource.getRepository(OrderItem);
    const rows = await orderItemRepo
      .createQueryBuilder("orderItem")
      .innerJoin(Order, "o", "o.id = orderItem.orderId")
      .select("orderItem.itemId", "itemId")
      .addSelect("MAX(orderItem.nameSnapshot)", "name")
      .addSelect("COALESCE(SUM(orderItem.quantity), 0)", "quantity")
      .addSelect("COALESCE(SUM(orderItem.lineTotal), 0)", "revenue")
      .where("o.restaurantId = :restaurantId", { restaurantId })
      .andWhere("o.createdAt >= :rangeStart", { rangeStart: rangeStart.toISOString() })
      .andWhere("o.createdAt < :rangeEnd", { rangeEnd: rangeEnd.toISOString() })
      .andWhere("o.status IN (:...revenueStatuses)", { revenueStatuses: REVENUE_ORDER_STATUSES })
      .groupBy("orderItem.itemId")
      .orderBy("COALESCE(SUM(orderItem.quantity), 0)", "DESC")
      .addOrderBy("COALESCE(SUM(orderItem.lineTotal), 0)", "DESC")
      .limit(limit)
      .getRawMany<{ itemId: string | number; name: string; quantity: string | number; revenue: string | number }>();

    res.json({
      range,
      items: rows.map((row) => ({
        itemId: Number(row.itemId),
        name: row.name,
        quantity: Number(row.quantity ?? 0),
        revenue: toMoneyString(row.revenue)
      }))
    });
  } catch (error) {
    next(error);
  }
});

export default router;
