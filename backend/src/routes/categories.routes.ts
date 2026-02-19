import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { Category } from "../entities/Category";
import { HttpError } from "../middleware/error-handler";
import { requireAuth } from "../middleware/auth";

const router = Router();

const createSchema = z.object({
  name: z.string().trim().min(1, "Category name is required"),
  sortOrder: z.number().int().optional().default(0)
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    sortOrder: z.number().int().optional()
  })
  .refine((data) => data.name !== undefined || data.sortOrder !== undefined, {
    message: "At least one field is required"
  });

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const repo = AppDataSource.getRepository(Category);
    const categories = await repo.find({
      where: { restaurantId: req.authUser!.restaurantId },
      order: { sortOrder: "ASC", createdAt: "ASC" }
    });

    res.json({ categories });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.parse({
      name: req.body.name,
      sortOrder: req.body.sortOrder !== undefined ? Number(req.body.sortOrder) : undefined
    });

    const repo = AppDataSource.getRepository(Category);
    const category = repo.create({
      restaurantId: req.authUser!.restaurantId,
      name: parsed.name,
      sortOrder: parsed.sortOrder
    });

    const saved = await repo.save(category);
    res.status(201).json({ category: saved });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      throw new HttpError(400, "Invalid category id");
    }

    const parsed = updateSchema.parse({
      name: req.body.name,
      sortOrder: req.body.sortOrder !== undefined ? Number(req.body.sortOrder) : undefined
    });

    const repo = AppDataSource.getRepository(Category);
    const category = await repo.findOne({
      where: { id, restaurantId: req.authUser!.restaurantId }
    });

    if (!category) {
      throw new HttpError(404, "Category not found");
    }

    if (parsed.name !== undefined) {
      category.name = parsed.name;
    }

    if (parsed.sortOrder !== undefined) {
      category.sortOrder = parsed.sortOrder;
    }

    const saved = await repo.save(category);
    res.json({ category: saved });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      throw new HttpError(400, "Invalid category id");
    }

    const repo = AppDataSource.getRepository(Category);
    const category = await repo.findOne({
      where: { id, restaurantId: req.authUser!.restaurantId }
    });

    if (!category) {
      throw new HttpError(404, "Category not found");
    }

    await repo.delete({ id: category.id, restaurantId: req.authUser!.restaurantId });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
