import { Request, Response, Router } from "express";
import multer from "multer";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { Item } from "../entities/Item";
import { Category } from "../entities/Category";
import { HttpError } from "../middleware/error-handler";
import { requireAuth } from "../middleware/auth";
import { ImageUploadService } from "../services/image-upload.service";

const router = Router();
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      callback(new HttpError(400, "Only JPEG, PNG, and WEBP images are allowed"));
      return;
    }
    callback(null, true);
  }
});

const runItemImageUpload = async (req: Request, res: Response): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    upload.single("image")(req, res, (error: unknown) => {
      if (!error) {
        resolve();
        return;
      }

      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        reject(new HttpError(400, "Image size must be 2MB or less"));
        return;
      }

      reject(error);
    });
  });
};

const createSchema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().trim().min(1, "Item name is required"),
  description: z.string().trim().optional().nullable(),
  price: z.number().min(0, "Price must be >= 0"),
  isAvailable: z.boolean().optional().default(true)
});

const updateSchema = z
  .object({
    categoryId: z.number().int().positive().optional(),
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().optional().nullable(),
    price: z.number().min(0).optional(),
    isAvailable: z.boolean().optional()
  })
  .refine(
    (data) =>
      data.categoryId !== undefined ||
      data.name !== undefined ||
      data.description !== undefined ||
      data.price !== undefined ||
      data.isAvailable !== undefined,
    {
    message: "At least one field is required"
    }
  );

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const categoryIdParam = req.query.categoryId as string | undefined;
    const filters: { restaurantId: number; categoryId?: number } = {
      restaurantId: req.authUser!.restaurantId
    };

    if (categoryIdParam !== undefined) {
      const categoryId = Number(categoryIdParam);
      if (!Number.isInteger(categoryId)) {
        throw new HttpError(400, "Invalid categoryId filter");
      }
      filters.categoryId = categoryId;
    }

    const repo = AppDataSource.getRepository(Item);
    const items = await repo.find({
      where: filters,
      order: { createdAt: "DESC" }
    });

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.parse({
      categoryId: Number(req.body.categoryId),
      name: req.body.name,
      description: req.body.description,
      price: Number(req.body.price),
      isAvailable: req.body.isAvailable ?? true
    });

    const categoryRepo = AppDataSource.getRepository(Category);
    const category = await categoryRepo.findOne({
      where: { id: parsed.categoryId, restaurantId: req.authUser!.restaurantId }
    });

    if (!category) {
      throw new HttpError(400, "Category does not belong to this restaurant");
    }

    const repo = AppDataSource.getRepository(Item);
    const item = repo.create({
      restaurantId: req.authUser!.restaurantId,
      categoryId: parsed.categoryId,
      name: parsed.name,
      description: parsed.description ?? null,
      price: parsed.price.toFixed(2),
      imageUrl: null,
      isAvailable: parsed.isAvailable
    });

    const saved = await repo.save(item);
    res.status(201).json({ item: saved });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      throw new HttpError(400, "Invalid item id");
    }

    const parsed = updateSchema.parse({
      categoryId: req.body.categoryId !== undefined ? Number(req.body.categoryId) : undefined,
      name: req.body.name,
      description: req.body.description,
      price: req.body.price !== undefined ? Number(req.body.price) : undefined,
      isAvailable: req.body.isAvailable
    });

    const repo = AppDataSource.getRepository(Item);
    const item = await repo.findOne({ where: { id, restaurantId: req.authUser!.restaurantId } });

    if (!item) {
      throw new HttpError(404, "Item not found");
    }

    if (parsed.categoryId !== undefined && parsed.categoryId !== item.categoryId) {
      const categoryRepo = AppDataSource.getRepository(Category);
      const category = await categoryRepo.findOne({
        where: { id: parsed.categoryId, restaurantId: req.authUser!.restaurantId }
      });

      if (!category) {
        throw new HttpError(400, "Category does not belong to this restaurant");
      }

      item.categoryId = parsed.categoryId;
    }

    if (parsed.name !== undefined) {
      item.name = parsed.name;
    }

    if (parsed.description !== undefined) {
      item.description = parsed.description ? parsed.description : null;
    }

    if (parsed.price !== undefined) {
      item.price = parsed.price.toFixed(2);
    }

    if (parsed.isAvailable !== undefined) {
      item.isAvailable = parsed.isAvailable;
    }

    const saved = await repo.save(item);
    res.json({ item: saved });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/image", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      throw new HttpError(400, "Invalid item id");
    }

    await runItemImageUpload(req, res);

    if (!req.file) {
      throw new HttpError(400, "Image file is required");
    }

    const repo = AppDataSource.getRepository(Item);
    const item = await repo.findOne({ where: { id, restaurantId: req.authUser!.restaurantId } });

    if (!item) {
      throw new HttpError(404, "Item not found");
    }

    const imageUploadService = new ImageUploadService();
    let uploadedImage: { secureUrl: string };

    try {
      uploadedImage = await imageUploadService.uploadItemImage({
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        restaurantId: req.authUser!.restaurantId,
        itemId: item.id
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Cloudinary is not configured") {
        throw new HttpError(500, "Image upload service is not configured");
      }

      throw new HttpError(502, "Failed to upload image");
    }

    item.imageUrl = uploadedImage.secureUrl;
    const saved = await repo.save(item);

    res.json({ item: saved });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/image", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      throw new HttpError(400, "Invalid item id");
    }

    const repo = AppDataSource.getRepository(Item);
    const item = await repo.findOne({ where: { id, restaurantId: req.authUser!.restaurantId } });
    if (!item) {
      throw new HttpError(404, "Item not found");
    }

    item.imageUrl = null;
    const saved = await repo.save(item);
    res.json({ item: saved });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      throw new HttpError(400, "Invalid item id");
    }

    const repo = AppDataSource.getRepository(Item);
    const item = await repo.findOne({ where: { id, restaurantId: req.authUser!.restaurantId } });

    if (!item) {
      throw new HttpError(404, "Item not found");
    }

    await repo.delete({ id: item.id, restaurantId: req.authUser!.restaurantId });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
