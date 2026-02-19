import request from "supertest";
import { createApp } from "../../app";
import { AppDataSource } from "../../config/data-source";
import { Restaurant } from "../../entities/Restaurant";
import { User } from "../../entities/User";

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
});
