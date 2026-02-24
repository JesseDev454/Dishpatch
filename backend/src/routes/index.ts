import { Router } from "express";
import authRoutes from "./auth.routes";
import categoryRoutes from "./categories.routes";
import itemRoutes from "./items.routes";
import ordersRoutes from "./orders.routes";
import publicRoutes from "./public.routes";
import webhooksRoutes from "./webhooks.routes";
import analyticsRoutes from "./analytics.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/categories", categoryRoutes);
router.use("/items", itemRoutes);
router.use("/orders", ordersRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/public", publicRoutes);
router.use("/webhooks", webhooksRoutes);

export default router;
