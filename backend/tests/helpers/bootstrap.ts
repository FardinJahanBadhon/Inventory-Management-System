import { LocationCategory } from "@prisma/client";
import { config } from "../../src/config";
import { prisma } from "../../src/lib/prisma";
import { hashPassword } from "../../src/lib/password";

// Hard safety net, independent of whether env-loading order is correct:
// checks the ACTUAL resolved config the app's Prisma client was built
// from (not a fresh, possibly-different read of process.env) and refuses
// to run any destructive operation if it doesn't look like the test
// database. This exists because of a real incident during Phase 10
// development — ES import hoisting caused src/config to evaluate (baking
// in DATABASE_URL) before tests/setup.ts's env override ran, so
// `resetAndBootstrapTestDatabase` briefly wiped the development database.
// Do not remove this guard even if the loading-order fix looks correct;
// it is the thing that makes a future regression here loud and harmless
// instead of silent and destructive.
function assertUsingTestDatabase(): void {
  if (!config.databaseUrl.includes("inventory_management_test")) {
    throw new Error(
      "Refusing to run destructive test database setup: the resolved DATABASE_URL " +
        `does not look like the test database (expected it to contain "inventory_management_test", got: ${config.databaseUrl}). ` +
        "This almost certainly means tests/setup.ts's environment override did not take effect before src/config was loaded.",
    );
  }
}

// Mirrors prisma/seed.ts's logic (same two invariants: one Administration
// Office, one default admin), but as an importable function against the
// app's own `prisma` client, rather than executing that script (which
// opens its own separate PrismaClient and runs unconditionally on import).
export const TEST_ADMIN_USERNAME = "admin";
export const TEST_ADMIN_PASSWORD = "TestAdmin123!";
export const TEST_ADMINISTRATION_OFFICE_NAME = "Administration Office";

export interface TestBootstrapResult {
  administrationOfficeId: string;
  adminUserId: string;
}

// Deletes every row from every table (children before parents, respecting
// the FK RESTRICT constraints) and recreates exactly the Administration
// Office + default admin — the same state a fresh production database
// would be in immediately after `npm run db:seed`. Called before every
// single test (see tests/setup.ts) so no test ever depends on data left
// behind by another.
export async function resetAndBootstrapTestDatabase(): Promise<TestBootstrapResult> {
  assertUsingTestDatabase();

  await prisma.inventory.deleteMany();
  await prisma.user.deleteMany();
  await prisma.product.deleteMany();
  await prisma.location.deleteMany();

  const administrationOffice = await prisma.location.create({
    data: {
      name: TEST_ADMINISTRATION_OFFICE_NAME,
      category: LocationCategory.ADMINISTRATION,
      isActive: true,
    },
  });

  const passwordHash = await hashPassword(TEST_ADMIN_PASSWORD);

  const adminUser = await prisma.user.create({
    data: {
      name: "Test Administrator",
      username: TEST_ADMIN_USERNAME,
      passwordHash,
      locationId: administrationOffice.id,
      isActive: true,
    },
  });

  return {
    administrationOfficeId: administrationOffice.id,
    adminUserId: adminUser.id,
  };
}

// The find-or-create pattern prisma/seed.ts actually uses (as opposed to
// resetAndBootstrapTestDatabase's unconditional wipe-and-recreate, which is
// for test isolation, not for testing bootstrap idempotency itself). Used
// specifically to verify that running bootstrap against a database that
// already has the office/admin does not create duplicates — the real
// property "idempotent bootstrap" means, matching the seed script's own
// findFirst-then-create logic.
export async function ensureBootstrap(): Promise<TestBootstrapResult> {
  assertUsingTestDatabase();

  const existingOffice = await prisma.location.findFirst({
    where: { name: TEST_ADMINISTRATION_OFFICE_NAME, category: LocationCategory.ADMINISTRATION },
  });

  const administrationOffice =
    existingOffice ??
    (await prisma.location.create({
      data: {
        name: TEST_ADMINISTRATION_OFFICE_NAME,
        category: LocationCategory.ADMINISTRATION,
        isActive: true,
      },
    }));

  const existingAdmin = await prisma.user.findUnique({ where: { username: TEST_ADMIN_USERNAME } });

  const adminUser =
    existingAdmin ??
    (await prisma.user.create({
      data: {
        name: "Test Administrator",
        username: TEST_ADMIN_USERNAME,
        passwordHash: await hashPassword(TEST_ADMIN_PASSWORD),
        locationId: administrationOffice.id,
        isActive: true,
      },
    }));

  return {
    administrationOfficeId: administrationOffice.id,
    adminUserId: adminUser.id,
  };
}
