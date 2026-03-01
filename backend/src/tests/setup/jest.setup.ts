import { AppDataSource } from "../../config/data-source";
import { waitForAsyncJobs } from "../../jobs/async-jobs";
import { clearPasswordResetIpRateLimiter } from "../../utils/password-reset";

const appTables = ["payments", "order_items", "orders", "items", "categories", "users", "restaurants"] as const;

const clearDatabase = async (): Promise<void> => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Refusing to truncate tables outside test environment.");
  }

  const tableList = appTables.map((table) => `"${table}"`).join(", ");
  await AppDataSource.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
};

beforeAll(async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
});

beforeEach(async () => {
  clearPasswordResetIpRateLimiter();
  await clearDatabase();
});

afterEach(async () => {
  await waitForAsyncJobs();
});

afterAll(async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});
