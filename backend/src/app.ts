import "reflect-metadata";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import apiRoutes from "./routes";
import { errorHandler } from "./middleware/error-handler";

export const createApp = () => {
  const app = express();

  const allowedOriginPattern = /^http:\/\/localhost:\d+$/;
  const normalizeOrigin = (origin: string): string => origin.replace(/\/$/, "");
  const allowedOrigins = new Set(env.frontendUrls.map(normalizeOrigin));

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        const normalizedOrigin = normalizeOrigin(origin);

        if (allowedOrigins.has(normalizedOrigin) || (env.nodeEnv !== "production" && allowedOriginPattern.test(origin))) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin not allowed by CORS"));
      },
      credentials: true
    })
  );
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        const requestUrl = req.url ?? "";
        if (requestUrl === "/webhooks/paystack") {
          (req as unknown as { rawBody?: Buffer }).rawBody = buf;
        }
      }
    })
  );
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/", apiRoutes);
  app.use(errorHandler);

  return app;
};
