import { Router } from "express";
import { In } from "typeorm";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { ORDER_STATUSES, Order, OrderStatus } from "../entities/Order";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error-handler";
import { assertOrderStatusTransition } from "../utils/order-state";
import { toOrderSummary } from "../realtime/order-summary";
import * as realtimeEmitter from "../realtime/realtime-emitter";

const router = Router();

router.use(requireAuth);

const querySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  page: z.coerce.number().int().positive().optional()
});

const statusUpdateSchema = z.object({
  status: z.enum(["ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED"]),
  cancelReason: z.string().trim().min(1).max(255).optional()
});

const parseStatusFilter = (value: string | undefined): OrderStatus[] => {
  if (!value || value.trim().length === 0) {
    return [];
  }

  const requested = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const invalid = requested.filter((entry) => !ORDER_STATUSES.includes(entry as OrderStatus));
  if (invalid.length > 0) {
    throw new HttpError(400, `Invalid status filter: ${invalid.join(", ")}`);
  }

  return requested as OrderStatus[];
};

router.get("/", async (req, res, next) => {
  try {
    const parsed = querySchema.parse(req.query);
    const page = parsed.page ?? 1;
    const limit = parsed.limit ?? 50;
    const statuses = parseStatusFilter(parsed.status);

    const repo = AppDataSource.getRepository(Order);
    const where =
      statuses.length > 0
        ? { restaurantId: req.authUser!.restaurantId, status: In(statuses) }
        : { restaurantId: req.authUser!.restaurantId };

    const [orders, total] = await repo.findAndCount({
      where,
      relations: { orderItems: true },
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit
    });

    res.json({
      orders: orders.map((order) => toOrderSummary(order)),
      pagination: {
        page,
        limit,
        total
      }
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Invalid order id");
    }

    const parsed = statusUpdateSchema.parse(req.body);
    const repo = AppDataSource.getRepository(Order);

    const order = await repo.findOne({
      where: {
        id,
        restaurantId: req.authUser!.restaurantId
      },
      relations: { orderItems: true }
    });

    if (!order) {
      throw new HttpError(404, "Order not found");
    }

    try {
      assertOrderStatusTransition(order.status, parsed.status);
    } catch (error) {
      throw new HttpError(400, (error as Error).message);
    }

    order.status = parsed.status;
    const saved = await repo.save(order);
    const summary = toOrderSummary(saved);
    realtimeEmitter.emitOrderUpdated(summary);

    res.json({ order: summary });
  } catch (error) {
    next(error);
  }
});

export default router;
