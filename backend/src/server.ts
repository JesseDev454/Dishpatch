import { AppDataSource } from "./config/data-source";
import { env } from "./config/env";
import { createApp } from "./app";

const bootstrap = async () => {
  await AppDataSource.initialize();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`Dishpatch backend running on port ${env.port}`);
  });
};

bootstrap().catch((error) => {
  console.error("Failed to bootstrap application", error);
  process.exit(1);
});
