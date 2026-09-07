import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export interface InventoryFilters {
  locationId?: string;
  productId?: string;
}

export interface OffsetPagination {
  skip: number;
  take: number;
}

const inventoryWithRelationsInclude = {
  product: { select: { id: true, code: true, name: true, unit: true } },
  location: { select: { id: true, name: true, category: true } },
} as const;

export type InventoryWithRelations = Prisma.InventoryGetPayload<{
  include: typeof inventoryWithRelationsInclude;
}>;

function buildWhereClause(filters: InventoryFilters): Prisma.InventoryWhereInput {
  const where: Prisma.InventoryWhereInput = {};

  if (filters.locationId) {
    where.locationId = filters.locationId;
  }

  if (filters.productId) {
    where.productId = filters.productId;
  }

  return where;
}

export async function findInventory(
  filters: InventoryFilters,
  pagination: OffsetPagination,
): Promise<{ items: InventoryWithRelations[]; total: number }> {
  const where = buildWhereClause(filters);

  const [items, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { createdAt: "desc" },
      include: inventoryWithRelationsInclude,
    }),
    prisma.inventory.count({ where }),
  ]);

  return { items, total };
}

export function findInventoryById(id: string): Promise<InventoryWithRelations | null> {
  return prisma.inventory.findUnique({
    where: { id },
    include: inventoryWithRelationsInclude,
  });
}

// Initialization always inserts — never searches for an existing
// Product+Location row to merge into. See PROJECT_RULES.md rule #5/#6.
export function createInventory(data: {
  productId: string;
  locationId: string;
  quantity: number;
}): Promise<InventoryWithRelations> {
  return prisma.inventory.create({
    data,
    include: inventoryWithRelationsInclude,
  });
}

// The concurrency-safe core of Distribute/Trash. `quantity: { gte: ... }`
// in the WHERE clause and the decrement in the same statement make the
// "is there enough stock?" check and the deduction a single atomic
// database operation — there is no read-modify-write gap for a second,
// concurrent request to race through. Two simultaneous requests against
// the same row serialize at Postgres's row lock; whichever commits second
// re-evaluates the WHERE clause against the already-decremented value.
//
// `locationId` is included in the WHERE clause too, so this can never
// decrement a row that doesn't belong to the caller's own location.
//
// Returns the updated row (with relations, for the response) if the guard
// passed, or null if it didn't — the row doesn't exist, doesn't belong to
// this location, or doesn't have enough quantity. The service determines
// which of those it is via a preceding existence/ownership check; this
// function's null return is understood there specifically as
// "insufficient quantity."
export async function decrementInventoryQuantity(
  id: string,
  locationId: string,
  requestedQuantity: number,
): Promise<InventoryWithRelations | null> {
  const result = await prisma.inventory.updateMany({
    where: {
      id,
      locationId,
      quantity: { gte: requestedQuantity },
    },
    data: {
      quantity: { decrement: requestedQuantity },
    },
  });

  if (result.count === 0) {
    return null;
  }

  return prisma.inventory.findUnique({
    where: { id },
    include: inventoryWithRelationsInclude,
  });
}
