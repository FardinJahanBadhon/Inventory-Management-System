import "dotenv/config";
import { PrismaClient, LocationCategory } from "@prisma/client";
import bcrypt from "bcrypt";
import { z } from "zod";

// This script is intentionally standalone (not importing src/config): it
// runs as a one-off `prisma db seed` process, separate from the Express
// app's request/response lifecycle, and only needs the handful of env vars
// below. The auth module (Phase 5) will validate JWT_SECRET etc. as part
// of the app's own config; that is a different concern from this bootstrap.
const bootstrapEnvSchema = z.object({
  ADMINISTRATION_OFFICE_NAME: z.string().min(1).default("Administration Office"),
  ADMIN_NAME: z.string().min(1).default("System Administrator"),
  ADMIN_USERNAME: z.string().min(1, "ADMIN_USERNAME is required"),
  ADMIN_PASSWORD: z.string().min(8, "ADMIN_PASSWORD must be at least 8 characters"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().positive().default(10),
});

const parsedEnv = bootstrapEnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Cannot run database bootstrap — invalid environment configuration:");
  console.error(parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsedEnv.data;
const prisma = new PrismaClient();

// Matches on both name AND category, per the requirement that the system
// "must always contain an administrative location named 'Administration
// Office' with category 'Administration'" — not just any ADMINISTRATION
// location that might exist under a different name.
async function ensureAdministrationOffice(): Promise<{ id: string; name: string }> {
  const existing = await prisma.location.findFirst({
    where: {
      name: env.ADMINISTRATION_OFFICE_NAME,
      category: LocationCategory.ADMINISTRATION,
    },
  });

  if (existing) {
    console.log(`Administration Office already exists (id: ${existing.id})`);
    return existing;
  }

  const created = await prisma.location.create({
    data: {
      name: env.ADMINISTRATION_OFFICE_NAME,
      category: LocationCategory.ADMINISTRATION,
      isActive: true,
    },
  });

  console.log(`Created Administration Office (id: ${created.id})`);
  return created;
}

async function ensureDefaultAdminUser(administrationOfficeId: string): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { username: env.ADMIN_USERNAME },
  });

  if (existing) {
    console.log(`Default admin user already exists (username: ${existing.username})`);
    return;
  }

  // The plaintext password exists only in this local variable, long enough
  // to be hashed, and is never logged or persisted.
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, env.BCRYPT_SALT_ROUNDS);

  const created = await prisma.user.create({
    data: {
      name: env.ADMIN_NAME,
      username: env.ADMIN_USERNAME,
      passwordHash,
      locationId: administrationOfficeId,
      isActive: true,
    },
  });

  console.log(`Created default admin user (username: ${created.username})`);
}

async function main(): Promise<void> {
  console.log("Running database bootstrap...");
  const administrationOffice = await ensureAdministrationOffice();
  await ensureDefaultAdminUser(administrationOffice.id);
  console.log("Database bootstrap complete.");
}

main()
  .catch((error: unknown) => {
    console.error("Database bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
