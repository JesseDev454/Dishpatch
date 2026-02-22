import { config } from "dotenv";

const runtimeNodeEnv = process.env.NODE_ENV ?? "development";
if (runtimeNodeEnv === "test") {
  config({ path: ".env.test" });
}
config();

const nodeEnv = runtimeNodeEnv;
const isProduction = nodeEnv === "production";
const isTest = nodeEnv === "test";

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  const parsed = Number(raw);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
};

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

const parseFrontendUrls = (raw: string | undefined): string[] => {
  const parsed = (raw ?? "http://localhost:5173")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (parsed.length === 0) {
    return ["http://localhost:5173"];
  }

  return parsed;
};

const defaultDatabaseUrl = isTest
  ? "postgres://postgres:postgres@localhost:5432/dishpatch_test"
  : "postgres://postgres:postgres@localhost:5432/dishpatch_dev";

const databaseUrl = getValue(["DATABASE_URL"], defaultDatabaseUrl);

const databaseNameFromUrl = (() => {
  try {
    const parsed = new URL(databaseUrl);
    return parsed.pathname.replace(/^\//, "");
  } catch {
    return "";
  }
})();

const frontendUrls = parseFrontendUrls(getValue(["FRONTEND_URL"], "http://localhost:5173"));
const configuredExpiryMinutes = parsePositiveInt(process.env.ORDER_EXPIRY_MINUTES, 30);
const expiryMinutes = isTest ? Math.max(configuredExpiryMinutes, 30) : configuredExpiryMinutes;

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: frontendUrls[0],
  frontendUrls,
  db: {
    databaseUrl
  },
  jwt: {
    accessSecret: getValue(["JWT_ACCESS_SECRET"], "dev_access_secret_change_me"),
    refreshSecret: getValue(["JWT_REFRESH_SECRET"], "dev_refresh_secret_change_me"),
    accessExpires: process.env.JWT_ACCESS_EXPIRES ?? "15m",
    refreshExpires: process.env.JWT_REFRESH_EXPIRES ?? "7d"
  },
  paystack: {
    secretKey: getValue(["PAYSTACK_SECRET_KEY"], "test_paystack_secret"),
    callbackUrl: getValue(["PAYSTACK_CALLBACK_URL"], "http://localhost:5173/payment/callback"),
    baseUrl: process.env.PAYSTACK_BASE_URL ?? "https://api.paystack.co"
  },
  email: {
    resendApiKey: getValue(["RESEND_API_KEY"], "re_test_placeholder"),
    from: getValue(["EMAIL_FROM"], "Dishpatch <noreply@dishpatch.local>"),
    appBaseUrl: getValue(["APP_BASE_URL"], "http://localhost:5173")
  },
  orders: {
    expiryMinutes,
    expiryJobIntervalSeconds: parsePositiveInt(process.env.ORDER_EXPIRY_JOB_INTERVAL_SECONDS, 60)
  }
};

if (!env.db.databaseUrl) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

if (isTest) {
  const normalizedDbName = databaseNameFromUrl.toLowerCase();
  if (normalizedDbName === "dishpatch" || normalizedDbName === "dishpatch_dev") {
    throw new Error("Refusing to run tests against development database. Use a dedicated test DATABASE_URL.");
  }
}
