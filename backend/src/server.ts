import { AppDataSource } from "./config/data-source";
import { env } from "./config/env";
import { createApp } from "./app";
import { createServer } from "http";
import { createRealtimeServer } from "./realtime/socket";
import { startExpiryJob } from "./jobs/order-expiry-job";
import { getCoreSchemaRegclass, getCurrentDatabaseName, getMissingCoreTables } from "./utils/schema-sanity";

const formatMigrationNames = (migrations: { name?: string }[]): string => {
  return migrations.map((migration) => migration.name ?? "unknown_migration").join(", ");
};

const runStartupMigrations = async (): Promise<void> => {
  const migrations = await AppDataSource.runMigrations();
  if (migrations.length === 0) {
    console.log("[startup] No pending migrations.");
    return;
  }

  console.log(`[startup] Applied migrations: ${formatMigrationNames(migrations)}`);
};

const ensureCoreSchemaReady = async (): Promise<void> => {
  const initialSchema = await getCoreSchemaRegclass(AppDataSource);
  const initialMissingTables = getMissingCoreTables(initialSchema);

  if (initialMissingTables.length > 0) {
    console.error(`[startup] Schema missing: ${initialMissingTables.join(", ")}`);
  }

  await runStartupMigrations();

  const schemaAfterMigrations = await getCoreSchemaRegclass(AppDataSource);
  const missingTables = getMissingCoreTables(schemaAfterMigrations);

  if (missingTables.length > 0) {
    console.error(`[startup] Schema missing: ${missingTables.join(", ")}`);
    throw new Error(`Core schema missing after migrations: ${missingTables.join(", ")}`);
  }

  console.log("[startup] Schema sanity check passed for restaurants, users, orders.");
};

const bootstrap = async () => {
  await AppDataSource.initialize();
  const currentDatabase = await getCurrentDatabaseName(AppDataSource);
  const backendVersion = process.env.npm_package_version ?? "unknown";
  const backendCommit =
    process.env.RENDER_GIT_COMMIT?.slice(0, 7) ??
    process.env.SOURCE_VERSION?.slice(0, 7) ??
    process.env.COMMIT_SHA?.slice(0, 7) ??
    "unknown";
  const databaseHost = (() => {
    try {
      return new URL(env.db.databaseUrl).hostname;
    } catch {
      return "unknown";
    }
  })();

  console.log(`[startup] Environment: ${env.nodeEnv}`);
  console.log(`[startup] Backend version: ${backendVersion} (${backendCommit})`);
  console.log(`[startup] Connected database: ${currentDatabase}`);
  console.log(`[startup] Database host: ${databaseHost}`);
  if (env.nodeEnv === "production" && databaseHost.includes("neon.tech") && !databaseHost.includes("-pooler")) {
    console.warn("[startup] DATABASE_URL appears to use a direct Neon host. Prefer a pooled Neon URL for lower auth latency.");
  }

  await ensureCoreSchemaReady();

  const app = createApp();
  const httpServer = createServer(app);
  createRealtimeServer(httpServer);
  startExpiryJob(AppDataSource);
  console.log("[startup] Order expiry job started.");

  httpServer.listen(env.port, () => {
    console.log(`[startup] Server address: http://0.0.0.0:${env.port}`);
    console.log(`Dishpatch backend running on port ${env.port}`);
  });
};

bootstrap().catch(async (error) => {
  console.error("Failed to bootstrap application", error);
  if (AppDataSource.isInitialized) {
    try {
      await AppDataSource.destroy();
    } catch (destroyError) {
      console.error("Failed to close database connection after bootstrap failure", destroyError);
    }
  }
  process.exit(1);
});
