import { AppDataSource } from "../../config/data-source";

export default async (): Promise<void> => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Refusing to reset schema outside test environment.");
  }

  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }

  await AppDataSource.initialize();
  try {
    if (AppDataSource.options.type === "postgres") {
      await AppDataSource.query("DROP SCHEMA IF EXISTS public CASCADE");
      await AppDataSource.query("CREATE SCHEMA IF NOT EXISTS public");
    }

    await AppDataSource.runMigrations();
  } finally {
    await AppDataSource.destroy();
  }
};
