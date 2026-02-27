import { AppDataSource } from "../config/data-source";
import { getCoreSchemaRegclass, getMissingCoreTables } from "../utils/schema-sanity";

const run = async (): Promise<void> => {
  await AppDataSource.initialize();
  try {
    const migrations = await AppDataSource.runMigrations();
    if (migrations.length === 0) {
      console.log("No pending migrations.");
    } else {
      console.log(`Applied migrations: ${migrations.map((migration) => migration.name ?? "unknown_migration").join(", ")}`);
    }

    const schema = await getCoreSchemaRegclass(AppDataSource);
    const missingTables = getMissingCoreTables(schema);

    if (missingTables.length > 0) {
      throw new Error(`Schema missing after migration run: ${missingTables.join(", ")}`);
    }

    console.log("Migrations completed successfully and core schema is ready.");
  } finally {
    await AppDataSource.destroy();
  }
};

run().catch((error) => {
  console.error("Failed to run migrations", error);
  process.exit(1);
});
