import bcrypt from "bcryptjs";
import { env } from "../config/env";

const SALT_ROUNDS = env.auth.bcryptSaltRounds;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};
