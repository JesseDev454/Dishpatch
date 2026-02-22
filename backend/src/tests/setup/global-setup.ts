import { AppDataSource } from "../../config/data-source";

export default async (): Promise<void> => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }

  await AppDataSource.initialize();
  try {
    if (AppDataSource.options.type === "postgres") {
      await AppDataSource.query("DROP SCHEMA IF EXISTS public CASCADE");
      await AppDataSource.query("CREATE SCHEMA public");
    }

    await AppDataSource.runMigrations();
  } finally {
    await AppDataSource.destroy();
  }
};
