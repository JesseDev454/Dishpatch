import "reflect-metadata";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import apiRoutes from "./routes";
import { errorHandler } from "./middleware/error-handler";
import { requestTiming } from "./middleware/request-timing";
import { requireAuth } from "./middleware/auth";
import { AppDataSource } from "./config/data-source";
import { getCoreSchemaCounts, getCoreSchemaRegclass, getCurrentDatabaseName } from "./utils/schema-sanity";

export const createApp = () => {
  const app = express();

  const allowedOriginPattern = /^http:\/\/localhost:\d+$/;
  const normalizeOrigin = (origin: string): string => origin.replace(/\/$/, "");
  const requiredProductionOrigin = "https://dishpatch.vercel.app";
  const allowedOrigins = new Set([...env.frontendUrls.map(normalizeOrigin), normalizeOrigin(requiredProductionOrigin)]);

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
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type"]
    })
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(requestTiming);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  const debugSchemaHandler = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (!AppDataSource.isInitialized) {
        res.status(503).json({ message: "Database not initialized" });
        return;
      }

      const [currentDatabase, tables] = await Promise.all([
        getCurrentDatabaseName(AppDataSource),
        getCoreSchemaRegclass(AppDataSource)
      ]);

      const counts = await getCoreSchemaCounts(AppDataSource, tables);

      res.json({
        currentDatabase,
        tables,
        counts
      });
    } catch (error) {
      next(error);
    }
  };

  if (env.nodeEnv === "production") {
    app.get("/debug/schema", requireAuth, debugSchemaHandler);
  } else {
    app.get("/debug/schema", debugSchemaHandler);
  }

  app.use("/", apiRoutes);
  app.use(errorHandler);

  return app;
};
