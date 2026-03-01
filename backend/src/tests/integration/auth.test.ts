import request from "supertest";
import { createApp } from "../../app";
import { AppDataSource } from "../../config/data-source";
import { env } from "../../config/env";
import { Restaurant } from "../../entities/Restaurant";
import { User } from "../../entities/User";
import { createPasswordResetToken } from "../../utils/password-reset";

describe("Auth", () => {
  const app = createApp();

  it("register creates restaurant and admin user", async () => {
    const response = await request(app).post("/auth/register").send({
      restaurantName: "Lagos Kitchen",
      email: "admin@lagoskitchen.com",
      password: "StrongPass123"
    });

    expect(response.status).toBe(201);
    expect(response.body.accessToken).toBeTruthy();
    expect(response.body.user.email).toBe("admin@lagoskitchen.com");
    expect(response.body.user.role).toBe("ADMIN");
    expect(response.body.user.restaurant.name).toBe("Lagos Kitchen");

    const restaurantRepo = AppDataSource.getRepository(Restaurant);
    const userRepo = AppDataSource.getRepository(User);
    const restaurant = await restaurantRepo.findOneBy({ id: response.body.user.restaurant.id });
    const user = await userRepo.findOneBy({ id: response.body.user.id });

    expect(restaurant).toBeTruthy();
    expect(user).toBeTruthy();
    expect(user?.restaurantId).toBe(restaurant?.id);
    expect(user?.role).toBe("ADMIN");
    expect(user?.passwordHash).not.toBe("StrongPass123");
  });

  it("login succeeds with correct credentials", async () => {
    await request(app).post("/auth/register").send({
      restaurantName: "Abuja Diner",
      email: "owner@abujadiner.com",
      password: "StrongPass123"
    });

    const loginResponse = await request(app).post("/auth/login").send({
      email: "owner@abujadiner.com",
      password: "StrongPass123"
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.accessToken).toBeTruthy();
    expect(loginResponse.body.user.email).toBe("owner@abujadiner.com");
  });

  it("login fails with wrong password", async () => {
    await request(app).post("/auth/register").send({
      restaurantName: "Port Harcourt Bites",
      email: "admin@phbites.com",
      password: "StrongPass123"
    });

    const loginResponse = await request(app).post("/auth/login").send({
      email: "admin@phbites.com",
      password: "WrongPassword"
    });

    expect(loginResponse.status).toBe(401);
    expect(loginResponse.body.message).toBe("Invalid credentials");
  });

  it("protected endpoint fails without bearer token", async () => {
    const response = await request(app).get("/categories");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized");
  });

  it("refresh returns a new access token when refresh cookie exists", async () => {
    const agent = request.agent(app);

    const registerResponse = await agent.post("/auth/register").send({
      restaurantName: "Kaduna Foods",
      email: "admin@kadunafoods.com",
      password: "StrongPass123"
    });

    expect(registerResponse.status).toBe(201);

    const refreshResponse = await agent.post("/auth/refresh").send();

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.accessToken).toBeTruthy();
    expect(refreshResponse.body.user.email).toBe("admin@kadunafoods.com");
  });

  it("forgot password always returns a generic response", async () => {
    const response = await request(app).post("/auth/forgot-password").send({
      email: "missing@dishpatch.test"
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      message: "If an account exists for that email, a reset link has been sent."
    });
  });

  it("disables password reset endpoints when the reset secret is missing", async () => {
    const originalSecret = env.auth.resetPasswordTokenSecret;
    env.auth.resetPasswordTokenSecret = null;

    try {
      const forgotPasswordResponse = await request(app).post("/auth/forgot-password").send({
        email: "missing@dishpatch.test"
      });
      expect(forgotPasswordResponse.status).toBe(500);
      expect(forgotPasswordResponse.body.message).toBe("Password reset not configured");

      const resetPasswordResponse = await request(app).post("/auth/reset-password").send({
        token: "placeholder-token",
        password: "NewStrongPass456"
      });
      expect(resetPasswordResponse.status).toBe(500);
      expect(resetPasswordResponse.body.message).toBe("Password reset not configured");
    } finally {
      env.auth.resetPasswordTokenSecret = originalSecret;
    }
  });

  it("forgot password stores reset metadata for an existing user", async () => {
    await request(app).post("/auth/register").send({
      restaurantName: "Reset Kitchen",
      email: "owner@resetkitchen.com",
      password: "StrongPass123"
    });

    const response = await request(app).post("/auth/forgot-password").send({
      email: "OWNER@RESETKITCHEN.COM"
    });

    expect(response.status).toBe(200);

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneByOrFail({ email: "owner@resetkitchen.com" });

    expect(user.passwordResetTokenHash).toBeTruthy();
    expect(user.passwordResetTokenExpiresAt).toBeTruthy();
    expect(user.passwordResetRequestedAt).toBeTruthy();
    expect(user.passwordResetUsedAt).toBeNull();
  });

  it("forgot password rate limit keeps the previous reset token active after the hourly limit", async () => {
    await request(app).post("/auth/register").send({
      restaurantName: "Rate Limit Kitchen",
      email: "owner@ratelimit.com",
      password: "StrongPass123"
    });

    const userRepo = AppDataSource.getRepository(User);
    for (let index = 0; index < 5; index += 1) {
      const response = await request(app).post("/auth/forgot-password").send({
        email: "owner@ratelimit.com"
      });
      expect(response.status).toBe(200);
    }

    const fifthUser = await userRepo.findOneByOrFail({ email: "owner@ratelimit.com" });
    const fifthTokenHash = fifthUser.passwordResetTokenHash;
    const fifthRequestedAt = fifthUser.passwordResetRequestedAt?.toISOString();

    const sixthResponse = await request(app).post("/auth/forgot-password").send({
      email: "owner@ratelimit.com"
    });
    expect(sixthResponse.status).toBe(200);

    const sixthUser = await userRepo.findOneByOrFail({ email: "owner@ratelimit.com" });
    expect(sixthUser.passwordResetTokenHash).toBe(fifthTokenHash);
    expect(sixthUser.passwordResetRequestedAt?.toISOString()).toBe(fifthRequestedAt);
  });

  it("reset password updates the password and clears reset metadata", async () => {
    await request(app).post("/auth/register").send({
      restaurantName: "Reset Flow Kitchen",
      email: "owner@resetflow.com",
      password: "StrongPass123"
    });

    const { token, tokenHash, expiresAt } = createPasswordResetToken();
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneByOrFail({ email: "owner@resetflow.com" });
    user.passwordResetTokenHash = tokenHash;
    user.passwordResetTokenExpiresAt = expiresAt;
    user.passwordResetRequestedAt = new Date();
    user.passwordResetUsedAt = null;
    await userRepo.save(user);

    const resetResponse = await request(app).post("/auth/reset-password").send({
      token,
      password: "NewStrongPass456"
    });

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body).toEqual({
      ok: true,
      message: "Password has been reset successfully."
    });

    const updatedUser = await userRepo.findOneByOrFail({ email: "owner@resetflow.com" });
    expect(updatedUser.passwordResetTokenHash).toBeNull();
    expect(updatedUser.passwordResetTokenExpiresAt).toBeNull();
    expect(updatedUser.passwordResetRequestedAt).toBeNull();
    expect(updatedUser.passwordResetUsedAt).toBeTruthy();

    const oldLogin = await request(app).post("/auth/login").send({
      email: "owner@resetflow.com",
      password: "StrongPass123"
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post("/auth/login").send({
      email: "owner@resetflow.com",
      password: "NewStrongPass456"
    });
    expect(newLogin.status).toBe(200);
  });

  it("reset password rejects an invalid token", async () => {
    const response = await request(app).post("/auth/reset-password").send({
      token: "invalid-token",
      password: "NewStrongPass456"
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Reset token is invalid or expired");
  });
});
