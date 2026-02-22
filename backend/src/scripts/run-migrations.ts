import { AppDataSource } from "../config/data-source";

const run = async (): Promise<void> => {
  await AppDataSource.initialize();
  try {
    await AppDataSource.runMigrations();
    console.log("Migrations completed successfully.");
  } finally {
    await AppDataSource.destroy();
  }
};

run().catch((error) => {
  console.error("Failed to run migrations", error);
  process.exit(1);
});
