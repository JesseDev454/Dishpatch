import { AppDataSource } from "./config/data-source";
import { env } from "./config/env";
import { createApp } from "./app";
import { createServer } from "http";
import { createRealtimeServer } from "./realtime/socket";

const bootstrap = async () => {
  await AppDataSource.initialize();

  const app = createApp();
  const httpServer = createServer(app);
  createRealtimeServer(httpServer);

  httpServer.listen(env.port, () => {
    console.log(`Dishpatch backend running on port ${env.port}`);
  });
};

bootstrap().catch((error) => {
  console.error("Failed to bootstrap application", error);
  process.exit(1);
});
