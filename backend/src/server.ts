import { createApp } from "./app";
import { config } from "./config";
import { prisma, disconnectPrisma } from "./lib/prisma";
import { logger } from "./shared/utils/logger";

async function main(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info("Database connection established");
  } catch (error) {
    logger.error("Failed to connect to the database", {
      error: error instanceof Error ? error.message : error,
    });
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info(`Inventory Management backend listening on port ${config.port}`, {
      environment: config.nodeEnv,
    });
  });

  let shuttingDown = false;

  function shutdown(signal: string): void {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`Received ${signal}, shutting down gracefully`);

    server.close(() => {
      disconnectPrisma()
        .then(() => {
          logger.info("Shutdown complete");
          process.exit(0);
        })
        .catch((error: unknown) => {
          logger.error("Error while disconnecting Prisma during shutdown", {
            error: error instanceof Error ? error.message : error,
          });
          process.exit(1);
        });
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
