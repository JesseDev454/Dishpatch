import { Router } from "express";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { AppDataSource } from "../config/data-source";
import { Restaurant } from "../entities/Restaurant";
import { User } from "../entities/User";
import { enqueueAsyncJob } from "../jobs/async-jobs";
import { HttpError } from "../middleware/error-handler";
import { EmailService } from "../services/email.service";
import { comparePassword, hashPassword } from "../utils/password";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  isPasswordResetConfigured,
  isPasswordResetEmailRateLimited,
  isPasswordResetIpRateLimited,
  passwordResetTokenMatches,
  recordPasswordResetEmailRequest,
  recordPasswordResetIpRequest
} from "../utils/password-reset";
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

const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional()
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Valid email is required")
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

const forgotPasswordResponse = {
  ok: true,
  message: "If an account exists for that email, a reset link has been sent."
} as const;

const createAuthStepLogger = (flow: "register" | "login", requestId?: string) => {
  const startedAt = process.hrtime.bigint();

  const logStep = (step: string): void => {
    if (env.nodeEnv === "test") {
      return;
    }

    const elapsedMs = Number((process.hrtime.bigint() - startedAt) / BigInt(1_000_000));
    const requestLabel = requestId ? `[${requestId}] ` : "";
    console.log(`${requestLabel}[auth.${flow}] +${elapsedMs}ms ${step}`);
  };

  return {
    logStep
  };
};

const logRefreshFailure = (reason: string, requestId?: string): void => {
  if (env.nodeEnv === "test") {
    return;
  }

  const requestLabel = requestId ? `[${requestId}] ` : "";
  console.warn(`${requestLabel}[auth.refresh] failed: ${reason}`);
};

const passwordResetEmailService = process.env.NODE_ENV === "test" ? null : new EmailService();

const ensurePasswordResetConfigured = (): void => {
  if (!isPasswordResetConfigured()) {
    throw new HttpError(500, "Password reset not configured");
  }
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

const getUniqueSlug = async (
  baseName: string,
  restaurantRepo = AppDataSource.getRepository(Restaurant)
): Promise<string> => {
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
  const { logStep } = createAuthStepLogger("register", req.requestId);
  logStep("start request");

  try {
    const parsed = registerSchema.parse(req.body);

    const userRepo = AppDataSource.getRepository(User);
    logStep("before DB lookup (find user)");
    const alreadyExists = await userRepo.exists({ where: { email: parsed.email.toLowerCase() } });
    logStep("after DB lookup");

    if (alreadyExists) {
      throw new HttpError(409, "Email already in use");
    }

    logStep("before password hash");
    const passwordHash = await hashPassword(parsed.password);
    logStep("after hash");

    logStep("before insert/save");
    const registration = await AppDataSource.transaction(async (trx) => {
      const restaurantRepo = trx.getRepository(Restaurant);
      const slug = await getUniqueSlug(parsed.restaurantName, restaurantRepo);

      const restaurant = restaurantRepo.create({
        name: parsed.restaurantName.trim(),
        slug
      });

      const savedRestaurant = await trx.save(restaurant);

      const user = trx.getRepository(User).create({
        restaurantId: savedRestaurant.id,
        email: parsed.email.toLowerCase(),
        passwordHash,
        role: "ADMIN"
      });

      const savedUser = await trx.save(user);

      return { savedUser, savedRestaurant };
    });
    logStep("after save");
    const user = {
      ...registration.savedUser,
      restaurant: registration.savedRestaurant
    } as User;

    const jwtPayload = {
      userId: user.id,
      restaurantId: user.restaurantId,
      role: user.role
    } as const;

    const accessToken = generateAccessToken(jwtPayload);
    const refreshToken = generateRefreshToken(jwtPayload);
    setRefreshCookie(res, refreshToken);

    logStep("before response sent");
    res.status(201).json({
      accessToken,
      refreshToken,
      user: userSafe(user)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  const { logStep } = createAuthStepLogger("login", req.requestId);
  logStep("start request");

  try {
    const parsed = loginSchema.parse(req.body);

    const userRepo = AppDataSource.getRepository(User);
    logStep("before DB lookup (find user)");
    const user = await userRepo.findOne({
      where: { email: parsed.email.toLowerCase() },
      relations: { restaurant: true }
    });
    logStep("after DB lookup");

    if (!user) {
      throw new HttpError(401, "Invalid credentials");
    }

    logStep("before password compare");
    const isValid = await comparePassword(parsed.password, user.passwordHash);
    logStep("after compare");
    if (!isValid) {
      throw new HttpError(401, "Invalid credentials");
    }

    logStep("before insert/save (n/a)");
    logStep("after save (n/a)");

    const jwtPayload = {
      userId: user.id,
      restaurantId: user.restaurantId,
      role: user.role
    } as const;

    const accessToken = generateAccessToken(jwtPayload);
    const refreshToken = generateRefreshToken(jwtPayload);
    setRefreshCookie(res, refreshToken);

    logStep("before response sent");
    res.json({ accessToken, refreshToken, user: userSafe(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const parsed = refreshSchema.parse(req.body ?? {});
    const token = (req.cookies?.refreshToken as string | undefined) ?? parsed.refreshToken;

    if (!token) {
      logRefreshFailure("missing_token", req.requestId);
      throw new HttpError(401, "Unauthorized");
    }

    let payload: ReturnType<typeof verifyRefreshToken>;
    try {
      payload = verifyRefreshToken(token);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        logRefreshFailure("expired_token", req.requestId);
      } else if (error instanceof JsonWebTokenError) {
        logRefreshFailure("invalid_token", req.requestId);
      } else {
        logRefreshFailure("token_verification_error", req.requestId);
      }
      throw new HttpError(401, "Unauthorized");
    }

    if (payload.type !== "refresh") {
      logRefreshFailure("invalid_token_type", req.requestId);
      throw new HttpError(401, "Unauthorized");
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: payload.userId, restaurantId: payload.restaurantId },
      relations: { restaurant: true }
    });

    if (!user) {
      logRefreshFailure("user_not_found", req.requestId);
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

    res.json({ accessToken, refreshToken, user: userSafe(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (_req, res) => {
  clearRefreshCookie(res);
  res.status(204).send();
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    ensurePasswordResetConfigured();
    const parsed = forgotPasswordSchema.parse(req.body);
    const normalizedEmail = parsed.email.toLowerCase();
    const userRepo = AppDataSource.getRepository(User);
    const emailRateLimited = isPasswordResetEmailRateLimited(normalizedEmail);
    const ipRateLimited = isPasswordResetIpRateLimited(req.ip);

    const user = await userRepo.findOne({
      where: { email: normalizedEmail },
      relations: { restaurant: true }
    });

    if (!emailRateLimited && !ipRateLimited) {
      recordPasswordResetEmailRequest(normalizedEmail);
      recordPasswordResetIpRequest(req.ip);
    }

    if (user && !emailRateLimited && !ipRateLimited) {
      const { token, tokenHash, expiresAt } = createPasswordResetToken();
      const now = new Date();

      user.passwordResetTokenHash = tokenHash;
      user.passwordResetTokenExpiresAt = expiresAt;
      user.passwordResetRequestedAt = now;
      user.passwordResetUsedAt = null;
      await userRepo.save(user);

      if (passwordResetEmailService) {
        enqueueAsyncJob(async () => {
          try {
            await passwordResetEmailService.sendPasswordResetEmail(user, token);
          } catch (error) {
            console.error(`[auth.forgot-password] failed to send reset email for ${normalizedEmail}`, error);
          }
        });
      }
    }

    res.status(200).json(forgotPasswordResponse);
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    ensurePasswordResetConfigured();
    const parsed = resetPasswordSchema.parse(req.body);
    const userRepo = AppDataSource.getRepository(User);
    const tokenHash = hashPasswordResetToken(parsed.token);
    const user = await userRepo.findOne({
      where: {
        passwordResetTokenHash: tokenHash
      }
    });

    if (!user || !user.passwordResetTokenHash || !passwordResetTokenMatches(user.passwordResetTokenHash, parsed.token)) {
      throw new HttpError(400, "Reset token is invalid or expired");
    }

    const now = new Date();
    if (!user.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt <= now || user.passwordResetUsedAt) {
      throw new HttpError(400, "Reset token is invalid or expired");
    }

    const nextPasswordHash = await hashPassword(parsed.password);
    user.passwordHash = nextPasswordHash;
    user.passwordResetTokenHash = null;
    user.passwordResetTokenExpiresAt = null;
    user.passwordResetRequestedAt = null;
    user.passwordResetUsedAt = now;
    await userRepo.save(user);

    clearRefreshCookie(res);
    res.status(200).json({
      ok: true,
      message: "Password has been reset successfully."
    });
  } catch (error) {
    next(error);
  }
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
