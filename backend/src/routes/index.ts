import { Router } from "express";
import authRoutes from "./auth.routes";
import categoryRoutes from "./categories.routes";
import itemRoutes from "./items.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/categories", categoryRoutes);
router.use("/items", itemRoutes);

export default router;
