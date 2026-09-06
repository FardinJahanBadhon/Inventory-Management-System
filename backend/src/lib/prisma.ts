import { PrismaClient } from "@prisma/client";
import { config } from "../config";

// The single PrismaClient instance for the whole process. Every module's
// repository (from Phase 6 onward) imports this — never instantiate
// `new PrismaClient()` anywhere else, since each instance opens its own
// connection pool.
export const prisma = new PrismaClient({
  log: config.isProduction ? ["error"] : ["warn", "error"],
});

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
