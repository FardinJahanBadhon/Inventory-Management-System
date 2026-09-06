-- CreateEnum
CREATE TYPE "LocationCategory" AS ENUM ('ADMINISTRATION', 'STORE', 'LAB', 'WARD', 'PHARMACY');

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "LocationCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Location_category_idx" ON "Location"("category");

-- CreateIndex
CREATE INDEX "Location_isActive_idx" ON "Location"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_locationId_idx" ON "User"("locationId");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

-- CreateIndex
CREATE INDEX "Inventory_locationId_idx" ON "Inventory"("locationId");

-- CreateIndex
CREATE INDEX "Inventory_productId_idx" ON "Inventory"("productId");

-- CreateIndex
CREATE INDEX "Inventory_locationId_productId_idx" ON "Inventory"("locationId", "productId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint
-- Hand-added: the Prisma schema DSL has no first-class syntax for arbitrary
-- CHECK constraints, so this is added directly in the migration SQL. It is
-- a last-line-of-defense safety net, not the primary quantity guard — the
-- primary guard is the service-layer conditional update
-- (`WHERE quantity >= requestedQuantity`) used by Distribute/Trash, which
-- prevents the race condition described in Phase 1 §15. This constraint
-- exists to reject negative quantities even if a future code path forgets
-- that check.
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_quantity_non_negative" CHECK ("quantity" >= 0);

-- CreateIndex (partial unique index)
-- Hand-added: enforces "at most one Location with category = ADMINISTRATION"
-- at the database level, without a plain unique constraint on `category`
-- (which would incorrectly also limit STORE/LAB/WARD/PHARMACY to one each —
-- forbidden, since multiple Store/Lab/Ward/Pharmacy locations are required
-- to be valid). A partial index only applies to rows matching its WHERE
-- clause, so non-ADMINISTRATION rows are entirely unaffected by it. This is
-- a second, database-enforced line of defense behind the application-level
-- bootstrap/deactivation checks in prisma/seed.ts and the future location
-- service — not a replacement for them.
CREATE UNIQUE INDEX "Location_single_administration_office" ON "Location"("category") WHERE ("category" = 'ADMINISTRATION');
