import request from "supertest";
import { Express } from "express";

type RegisterInput = {
  restaurantName: string;
  email: string;
  password: string;
};

export const registerAndGetToken = async (
  app: Express,
  input: RegisterInput
): Promise<{ accessToken: string; user: { restaurant: { id: number } } }> => {
  const response = await request(app).post("/auth/register").send(input);
  expect(response.status).toBe(201);
  expect(response.body.accessToken).toBeTruthy();
  return response.body;
};
