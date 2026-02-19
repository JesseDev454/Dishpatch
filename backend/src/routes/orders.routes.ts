import { Router } from "express";
import { AppDataSource } from "../config/data-source";
import { Order } from "../entities/Order";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const repo = AppDataSource.getRepository(Order);
    const orders = await repo.find({
      where: { restaurantId: req.authUser!.restaurantId },
      relations: { orderItems: true },
      order: { createdAt: "DESC" }
    });

    res.json({ orders });
  } catch (error) {
    next(error);
  }
});

export default router;
