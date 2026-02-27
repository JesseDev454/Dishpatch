import { Router } from "express";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { z } from "zod";
import { AppDataSource } from "../config/data-source";
import { Restaurant } from "../entities/Restaurant";
import { User } from "../entities/User";
import { HttpError } from "../middleware/error-handler";
import { comparePassword, hashPassword } from "../utils/password";
import {
  clearRefreshCookie,
  generateAccessToken,
  generateRefreshToken,
  setRefreshCookie,
  verifyRefreshToken
} from "../utils/jwt";
import { slugify } from "../utils/slug";
import { requireAuth } from "../middleware/auth";

const router = Router();

const registerSchema = z.object({
  restaurantName: z.string().trim().min(1, "Restaurant name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required")
});

const logRefreshFailure = (reason: string): void => {
  console.warn(`[auth.refresh] failed: ${reason}`);
};

const userSafe = (user: User) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  restaurant: {
    id: user.restaurant.id,
    name: user.restaurant.name,
    slug: user.restaurant.slug,
    bankName: user.restaurant.bankName,
    accountNumber: user.restaurant.accountNumber,
    accountName: user.restaurant.accountName,
    bankInstructions: user.restaurant.bankInstructions
  }
});

const bankDetailsSchema = z.object({
  bankName: z.string().trim().min(1, "Bank name is required"),
  accountNumber: z.string().trim().min(6, "Account number is required"),
  accountName: z.string().trim().min(1, "Account name is required"),
  bankInstructions: z.string().trim().optional().nullable()
});

const getUniqueSlug = async (baseName: string): Promise<string> => {
  const restaurantRepo = AppDataSource.getRepository(Restaurant);
  const baseSlug = slugify(baseName);
  let candidate = baseSlug;
  let index = 2;

  while (await restaurantRepo.exists({ where: { slug: candidate } })) {
    candidate = `${baseSlug}-${index}`;
    index += 1;
  }

  return candidate;
};

router.post("/register", async (req, res, next) => {
  try {
    const parsed = registerSchema.parse(req.body);

    const userRepo = AppDataSource.getRepository(User);
    const alreadyExists = await userRepo.exists({ where: { email: parsed.email.toLowerCase() } });

    if (alreadyExists) {
      throw new HttpError(409, "Email already in use");
    }

    const savedUser = await AppDataSource.transaction(async (trx) => {
      const slug = await getUniqueSlug(parsed.restaurantName);

      const restaurant = trx.getRepository(Restaurant).create({
        name: parsed.restaurantName.trim(),
        slug
      });

      const savedRestaurant = await trx.save(restaurant);

      const user = trx.getRepository(User).create({
        restaurantId: savedRestaurant.id,
        email: parsed.email.toLowerCase(),
        passwordHash: await hashPassword(parsed.password),
        role: "ADMIN"
      });

      return trx.save(user);
    });

    const user = await userRepo.findOne({
      where: { id: savedUser.id },
      relations: { restaurant: true }
    });

    if (!user) {
      throw new HttpError(500, "Registration failed");
    }

    const jwtPayload = {
      userId: user.id,
      restaurantId: user.restaurantId,
      role: user.role
    } as const;

    const accessToken = generateAccessToken(jwtPayload);
    const refreshToken = generateRefreshToken(jwtPayload);
    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      accessToken,
      user: userSafe(user)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body);

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { email: parsed.email.toLowerCase() },
      relations: { restaurant: true }
    });

    if (!user) {
      throw new HttpError(401, "Invalid credentials");
    }

    const isValid = await comparePassword(parsed.password, user.passwordHash);
    if (!isValid) {
      throw new HttpError(401, "Invalid credentials");
    }

    const jwtPayload = {
      userId: user.id,
      restaurantId: user.restaurantId,
      role: user.role
    } as const;

    const accessToken = generateAccessToken(jwtPayload);
    const refreshToken = generateRefreshToken(jwtPayload);
    setRefreshCookie(res, refreshToken);

    res.json({ accessToken, user: userSafe(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken as string | undefined;

    if (!token) {
      logRefreshFailure("missing_cookie");
      throw new HttpError(401, "Unauthorized");
    }

    let payload: ReturnType<typeof verifyRefreshToken>;
    try {
      payload = verifyRefreshToken(token);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        logRefreshFailure("expired_token");
      } else if (error instanceof JsonWebTokenError) {
        logRefreshFailure("invalid_token");
      } else {
        logRefreshFailure("token_verification_error");
      }
      throw new HttpError(401, "Unauthorized");
    }

    if (payload.type !== "refresh") {
      logRefreshFailure("invalid_token_type");
      throw new HttpError(401, "Unauthorized");
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: payload.userId, restaurantId: payload.restaurantId },
      relations: { restaurant: true }
    });

    if (!user) {
      logRefreshFailure("user_not_found");
      throw new HttpError(401, "Unauthorized");
    }

    const jwtPayload = {
      userId: user.id,
      restaurantId: user.restaurantId,
      role: user.role
    } as const;

    const accessToken = generateAccessToken(jwtPayload);
    const refreshToken = generateRefreshToken(jwtPayload);
    setRefreshCookie(res, refreshToken);

    res.json({ accessToken, user: userSafe(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (_req, res) => {
  clearRefreshCookie(res);
  res.status(204).send();
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: req.authUser!.userId, restaurantId: req.authUser!.restaurantId },
      relations: { restaurant: true }
    });

    if (!user) {
      throw new HttpError(401, "Unauthorized");
    }

    res.json({ user: userSafe(user) });
  } catch (error) {
    next(error);
  }
});

router.patch("/bank-details", requireAuth, async (req, res, next) => {
  try {
    const parsed = bankDetailsSchema.parse(req.body);

    const restaurantRepo = AppDataSource.getRepository(Restaurant);
    const restaurant = await restaurantRepo.findOne({ where: { id: req.authUser!.restaurantId } });
    if (!restaurant) {
      throw new HttpError(404, "Restaurant not found");
    }

    restaurant.bankName = parsed.bankName;
    restaurant.accountNumber = parsed.accountNumber;
    restaurant.accountName = parsed.accountName;
    restaurant.bankInstructions = parsed.bankInstructions?.trim() ? parsed.bankInstructions.trim() : null;

    const savedRestaurant = await restaurantRepo.save(restaurant);

    res.json({
      restaurant: {
        id: savedRestaurant.id,
        name: savedRestaurant.name,
        slug: savedRestaurant.slug,
        bankName: savedRestaurant.bankName,
        accountNumber: savedRestaurant.accountNumber,
        accountName: savedRestaurant.accountName,
        bankInstructions: savedRestaurant.bankInstructions
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
