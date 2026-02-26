import { AppDataSource } from "./config/data-source";
import { env } from "./config/env";
import { createApp } from "./app";
import { createServer } from "http";
import { createRealtimeServer } from "./realtime/socket";
import { startOrderExpiryJob } from "./jobs/order-expiry-job";

const bootstrap = async () => {
  await AppDataSource.initialize();
  const dbResult = await AppDataSource.query("SELECT current_database() AS current_database");
  const currentDatabase = Array.isArray(dbResult) && dbResult[0]?.current_database ? dbResult[0].current_database : "unknown";
  console.log(`[startup] Connected database: ${currentDatabase}`);

  const app = createApp();
  const httpServer = createServer(app);
  createRealtimeServer(httpServer);
  startOrderExpiryJob(AppDataSource);

  httpServer.listen(env.port, () => {
    console.log(`[startup] Server address: http://0.0.0.0:${env.port}`);
    console.log(`Dishpatch backend running on port ${env.port}`);
  });
};

bootstrap().catch((error) => {
  console.error("Failed to bootstrap application", error);
  process.exit(1);
});
