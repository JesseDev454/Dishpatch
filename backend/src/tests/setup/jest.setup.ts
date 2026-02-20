import { AppDataSource } from "../../config/data-source";

const appTables = ["payments", "order_items", "orders", "items", "categories", "users", "restaurants"] as const;

const clearDatabase = async (): Promise<void> => {
  await AppDataSource.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const table of appTables) {
    await AppDataSource.query(`TRUNCATE TABLE \`${table}\``);
  }
  await AppDataSource.query("SET FOREIGN_KEY_CHECKS = 1");
};

beforeAll(async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
});

beforeEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});
