import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { Restaurant } from "../entities/Restaurant";
import { Category } from "../entities/Category";
import { Item } from "../entities/Item";
import { Order } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import { Payment } from "../entities/Payment";
import { PaymentService } from "../services/payment.service";
import { PaystackService } from "../services/paystack.service";
import { env } from "../config/env";
import { HttpError } from "../middleware/error-handler";
import { isPendingOrderExpired } from "../utils/order-expiry";

const router = Router();

const RECEIPT_ALLOWED_ORDER_STATUSES = new Set<string>(["PAID", "ACCEPTED", "PREPARING", "READY", "COMPLETED"]);

const createOrderSchema = z.object({
  type: z.enum(["DELIVERY", "PICKUP"]),
  customerName: z.string().trim().min(1, "customerName is required"),
  customerPhone: z.string().trim().min(1, "customerPhone is required"),
  customerEmail: z.string().trim().email().optional().nullable(),
  deliveryAddress: z.string().trim().optional().nullable(),
  items: z
    .array(
      z.object({
        itemId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().positive()
      })
    )
    .min(1, "At least one item is required")
});

const getRestaurantBySlug = async (slug: string): Promise<Restaurant> => {
  const restaurantRepo = AppDataSource.getRepository(Restaurant);
  const restaurant = await restaurantRepo.findOne({ where: { slug } });
  if (!restaurant) {
    throw new HttpError(404, "Restaurant not found");
  }
  return restaurant;
};

router.get("/restaurants/:slug", async (req, res, next) => {
  try {
    const restaurant = await getRestaurantBySlug(req.params.slug);

    res.json({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        phone: restaurant.phone,
        address: restaurant.address
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/restaurants/:slug/menu", async (req, res, next) => {
  try {
    const restaurant = await getRestaurantBySlug(req.params.slug);

    const categoryRepo = AppDataSource.getRepository(Category);
    const itemRepo = AppDataSource.getRepository(Item);

    const [categories, items] = await Promise.all([
      categoryRepo.find({
        where: { restaurantId: restaurant.id },
        order: { sortOrder: "ASC", createdAt: "ASC" }
      }),
      itemRepo.find({
        where: { restaurantId: restaurant.id, isAvailable: true },
        order: { createdAt: "ASC" }
      })
    ]);

    const categoryIdToItems = new Map<number, Item[]>();
    for (const item of items) {
      const bucket = categoryIdToItems.get(item.categoryId) ?? [];
      bucket.push(item);
      categoryIdToItems.set(item.categoryId, bucket);
    }

    res.json({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug
      },
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        sortOrder: category.sortOrder,
        items: (categoryIdToItems.get(category.id) ?? []).map((item) => ({
          id: item.id,
          categoryId: item.categoryId,
          name: item.name,
          description: item.description,
          price: item.price,
          isAvailable: item.isAvailable
        }))
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.post("/restaurants/:slug/orders", async (req, res, next) => {
  try {
    const restaurant = await getRestaurantBySlug(req.params.slug);
    const parsed = createOrderSchema.parse(req.body);

    const normalizedAddress =
      parsed.deliveryAddress && parsed.deliveryAddress.trim().length > 0
        ? parsed.deliveryAddress.trim()
        : null;

    if (parsed.type === "DELIVERY" && !normalizedAddress) {
      throw new HttpError(400, "deliveryAddress is required for DELIVERY orders");
    }

    if (parsed.type === "PICKUP" && normalizedAddress !== null) {
      throw new HttpError(400, "deliveryAddress must be null for PICKUP orders");
    }

    const itemRepo = AppDataSource.getRepository(Item);
    const itemIdToRecord = new Map<number, Item>();
    for (const cartLine of parsed.items) {
      if (itemIdToRecord.has(cartLine.itemId)) {
        continue;
      }

      const item = await itemRepo.findOne({ where: { id: cartLine.itemId } });

      if (!item || item.restaurantId !== restaurant.id) {
        throw new HttpError(400, "One or more items do not belong to this restaurant");
      }

      if (!item.isAvailable) {
        throw new HttpError(400, `Item '${item.name}' is not available`);
      }

      itemIdToRecord.set(item.id, item);
    }

    const created = await AppDataSource.transaction(async (trx) => {
      let totalAmount = 0;

      const orderRepo = trx.getRepository(Order);
      const lineRepo = trx.getRepository(OrderItem);

      const order = orderRepo.create({
        restaurantId: restaurant.id,
        status: "PENDING_PAYMENT",
        type: parsed.type,
        customerName: parsed.customerName.trim(),
        customerPhone: parsed.customerPhone.trim(),
        customerEmail: parsed.customerEmail ? parsed.customerEmail.trim() : null,
        deliveryAddress: parsed.type === "DELIVERY" ? normalizedAddress : null,
        totalAmount: "0.00"
      });

      const savedOrder = await orderRepo.save(order);

      const lines: OrderItem[] = [];
      for (const cartLine of parsed.items) {
        const item = itemIdToRecord.get(cartLine.itemId)!;
        const unitPrice = Number(item.price);
        const lineTotal = unitPrice * cartLine.quantity;
        totalAmount += lineTotal;

        lines.push(
          lineRepo.create({
            orderId: savedOrder.id,
            itemId: item.id,
            nameSnapshot: item.name,
            unitPriceSnapshot: unitPrice.toFixed(2),
            quantity: cartLine.quantity,
            lineTotal: lineTotal.toFixed(2)
          })
        );
      }

      await lineRepo.save(lines);
      savedOrder.totalAmount = totalAmount.toFixed(2);
      const updatedOrder = await orderRepo.save(savedOrder);
      updatedOrder.orderItems = lines;

      return updatedOrder;
    });

    res.status(201).json({
      order: {
        id: created.id,
        restaurantId: created.restaurantId,
        status: created.status,
        type: created.type,
        customerName: created.customerName,
        customerPhone: created.customerPhone,
        deliveryAddress: created.deliveryAddress,
        totalAmount: created.totalAmount,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        items: created.orderItems.map((line) => ({
          id: line.id,
          itemId: line.itemId,
          nameSnapshot: line.nameSnapshot,
          unitPriceSnapshot: line.unitPriceSnapshot,
          quantity: line.quantity,
          lineTotal: line.lineTotal
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/orders/:orderId/paystack/initialize", async (req, res, next) => {
  try {
    const orderId = Number(req.params.orderId);
    if (!Number.isInteger(orderId)) {
      throw new HttpError(400, "Invalid order id");
    }

    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const orderRepo = AppDataSource.getRepository(Order);
    const order = await orderRepo.findOne({
      where: { id: orderId },
      relations: { orderItems: true }
    });

    if (!order) {
      throw new HttpError(404, "Order not found");
    }

    if (isPendingOrderExpired(order, new Date(), env.orders.expiryMinutes)) {
      order.status = "EXPIRED";
      await orderRepo.save(order);
      throw new HttpError(400, "Order payment window has expired");
    }

    if (order.status === "EXPIRED") {
      throw new HttpError(400, "Order payment window has expired");
    }

    if (order.status !== "PENDING_PAYMENT" && order.status !== "FAILED_PAYMENT") {
      throw new HttpError(400, "Order is not awaiting payment");
    }

    if (!order.orderItems || order.orderItems.length === 0) {
      throw new HttpError(400, "Order has no items");
    }

    if (!order.customerEmail) {
      if (!email) {
        throw new HttpError(400, "customerEmail is required");
      }
      order.customerEmail = email;
      await orderRepo.save(order);
    }

    let payment: Payment;
    try {
      const paymentService = new PaymentService();
      payment = await paymentService.createPendingPayment({ id: order.id });
    } catch (error) {
      throw new HttpError(400, (error as Error).message);
    }

    const paystackService = new PaystackService();
    const initResponse = await paystackService.initializeTransaction({
      email: order.customerEmail,
      amount: payment.amountKobo,
      reference: payment.reference,
      callback_url: env.paystack.callbackUrl,
      metadata: {
        orderId: order.id,
        restaurantId: order.restaurantId
      }
    });

    if (!initResponse?.status || !initResponse.data?.authorization_url) {
      throw new HttpError(502, "Failed to initialize payment");
    }

    res.json({
      authorizationUrl: initResponse.data.authorization_url,
      reference: initResponse.data.reference ?? payment.reference
    });
  } catch (error) {
    next(error);
  }
});

router.get("/payments/paystack/verify", async (req, res, next) => {
  try {
    const reference = String(req.query.reference ?? "").trim();
    if (!reference) {
      throw new HttpError(400, "reference is required");
    }

    const paymentRepo = AppDataSource.getRepository(Payment);
    const existingPayment = await paymentRepo.findOne({
      where: { reference },
      relations: { order: { restaurant: true } }
    });

    if (!existingPayment) {
      throw new HttpError(404, "Payment not found");
    }

    const existingOrder = existingPayment.order;
    if (existingOrder && isPendingOrderExpired(existingOrder, new Date(), env.orders.expiryMinutes)) {
      existingOrder.status = "EXPIRED";
      const orderRepo = AppDataSource.getRepository(Order);
      await orderRepo.save(existingOrder);
      throw new HttpError(400, "Order payment window has expired");
    }

    if (existingOrder?.status === "EXPIRED") {
      throw new HttpError(400, "Order payment window has expired");
    }

    if (existingPayment.status === "SUCCESS") {
      res.json({
        status: "success",
        payment: {
          reference: existingPayment.reference,
          status: existingPayment.status,
          paidAt: existingPayment.paidAt,
          amountKobo: existingPayment.amountKobo
        },
        order: existingOrder
          ? {
              id: existingOrder.id,
              status: existingOrder.status,
              totalAmount: existingOrder.totalAmount,
              restaurantSlug: existingOrder.restaurant?.slug ?? undefined
            }
          : null
      });
      return;
    }

    const paystackService = new PaystackService();
    const verifyResponse = await paystackService.verifyTransaction(reference);

    const paymentService = new PaymentService();

    if (verifyResponse?.data?.status === "success") {
      const payment = await paymentService.markPaymentSuccess(reference, verifyResponse);
      const orderRepo = AppDataSource.getRepository(Order);
      const order = await orderRepo.findOne({
        where: { id: payment.orderId },
        relations: { restaurant: true }
      });

      res.json({
        status: "success",
        payment: {
          reference: payment.reference,
          status: payment.status,
          paidAt: payment.paidAt,
          amountKobo: payment.amountKobo
        },
        order: order
          ? {
              id: order.id,
              status: order.status,
              totalAmount: order.totalAmount,
              restaurantSlug: order.restaurant?.slug ?? undefined
            }
          : null
      });
      return;
    }

    const failedPayment = await paymentService.markPaymentFailed(reference);
    const orderRepo = AppDataSource.getRepository(Order);
    const order = await orderRepo.findOne({
      where: { id: failedPayment.orderId },
      relations: { restaurant: true }
    });

    res.status(400).json({
      status: "failed",
      payment: {
        reference: failedPayment.reference,
        status: failedPayment.status
      },
      order: order
        ? {
            id: order.id,
            status: order.status,
            totalAmount: order.totalAmount,
            restaurantSlug: order.restaurant?.slug ?? undefined
          }
        : null
    });
  } catch (error) {
    next(error);
  }
});

router.get("/receipts/:reference", async (req, res, next) => {
  try {
    const reference = String(req.params.reference ?? "").trim();
    if (!reference) {
      throw new HttpError(404, "Receipt not found");
    }

    const paymentRepo = AppDataSource.getRepository(Payment);
    const payment = await paymentRepo.findOne({
      where: { reference },
      relations: { order: { orderItems: true, restaurant: true } }
    });

    if (!payment) {
      throw new HttpError(404, "Receipt not found");
    }

    if (payment.status !== "SUCCESS") {
      throw new HttpError(400, "Payment is not successful");
    }

    const order = payment.order;
    if (!order) {
      throw new HttpError(404, "Order not found");
    }

    if (!RECEIPT_ALLOWED_ORDER_STATUSES.has(order.status)) {
      throw new HttpError(400, "Order is not paid");
    }

    if (!order.restaurant) {
      throw new HttpError(404, "Restaurant not found");
    }

    res.json({
      restaurant: {
        name: order.restaurant.name
      },
      order: {
        id: order.id,
        type: order.type,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        deliveryAddress: order.deliveryAddress,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt
      },
      items: (order.orderItems ?? []).map((line) => ({
        nameSnapshot: line.nameSnapshot,
        unitPriceSnapshot: line.unitPriceSnapshot,
        quantity: line.quantity,
        lineTotal: line.lineTotal
      })),
      payment: {
        reference: payment.reference,
        paidAt: payment.paidAt,
        amountKobo: payment.amountKobo
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
