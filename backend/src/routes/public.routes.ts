import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { Restaurant } from "../entities/Restaurant";
import { Category } from "../entities/Category";
import { Item } from "../entities/Item";
import { Order } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import { HttpError } from "../middleware/error-handler";

const router = Router();

const createOrderSchema = z.object({
  type: z.enum(["DELIVERY", "PICKUP"]),
  customerName: z.string().trim().min(1, "customerName is required"),
  customerPhone: z.string().trim().min(1, "customerPhone is required"),
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

export default router;
