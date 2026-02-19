import { config } from "dotenv";

const runtimeNodeEnv = process.env.NODE_ENV ?? "development";
if (runtimeNodeEnv === "test") {
  config({ path: ".env.test" });
}
config();

const nodeEnv = runtimeNodeEnv;
const isProduction = nodeEnv === "production";
const isTest = nodeEnv === "test";

const getValue = (keys: string[], fallback: string): string => {
  for (const key of keys) {
    const raw = process.env[key];
    if (raw && raw.length > 0) {
      return raw;
    }
  }

  if (isProduction) {
    throw new Error(`Missing required environment variable: ${keys.join(" or ")}`);
  }

  return fallback;
};

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  db: {
    host: getValue(["DB_HOST"], "localhost"),
    port: Number(process.env.DB_PORT ?? (isTest ? 3307 : 3306)),
    user: getValue(["DB_USER", "DB_USERNAME"], "root"),
    password: process.env.DB_PASSWORD ?? "",
    database: getValue(["DB_NAME"], isTest ? "dishpatch_test" : "dishpatch")
  },
  jwt: {
    accessSecret: getValue(["JWT_ACCESS_SECRET"], "dev_access_secret_change_me"),
    refreshSecret: getValue(["JWT_REFRESH_SECRET"], "dev_refresh_secret_change_me"),
    accessExpires: process.env.JWT_ACCESS_EXPIRES ?? "15m",
    refreshExpires: process.env.JWT_REFRESH_EXPIRES ?? "7d"
  }
};

if (isTest && env.db.database === "dishpatch") {
  throw new Error("Refusing to run tests against development database 'dishpatch'. Use 'dishpatch_test'.");
}
