import express, { type Express } from "express";
import cors from "cors";
import { config } from "./config";
import { apiRouter } from "./routes";
import { notFoundHandler } from "./middlewares/not-found";
import { errorHandler } from "./middlewares/error-handler";
import { asyncHandler } from "./shared/utils/async-handler";
import { sendSuccess } from "./shared/utils/response";
import { prisma } from "./lib/prisma";

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  // A cheap `SELECT 1` (no table scan, single round trip) so /health also
  // proves the backend can actually reach PostgreSQL, not just that the
  // Express process is up. An unreachable database is reported as 503 so
  // uptime monitoring can key off the status code alone.
  app.get(
    "/health",
    asyncHandler(async (_req, res) => {
      let databaseStatus: "connected" | "unreachable" = "connected";

      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch {
        databaseStatus = "unreachable";
      }

      const statusCode = databaseStatus === "connected" ? 200 : 503;

      sendSuccess(
        res,
        {
          service: "inventory-management-backend",
          environment: config.nodeEnv,
          timestamp: new Date().toISOString(),
          database: databaseStatus,
        },
        "Server is healthy",
        statusCode,
      );
    }),
  );

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
