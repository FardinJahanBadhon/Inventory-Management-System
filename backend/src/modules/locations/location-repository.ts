import { Prisma, type Location, type LocationCategory } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export interface LocationFilters {
  search?: string;
  category?: LocationCategory;
  isActive?: boolean;
}

export interface OffsetPagination {
  skip: number;
  take: number;
}

function buildWhereClause(filters: LocationFilters): Prisma.LocationWhereInput {
  const where: Prisma.LocationWhereInput = {};

  if (filters.search) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }

  if (filters.category) {
    where.category = filters.category;
  }

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  return where;
}

export function createLocation(data: {
  name: string;
  category: LocationCategory;
  isActive: boolean;
}): Promise<Location> {
  return prisma.location.create({ data });
}

export function findLocationById(id: string): Promise<Location | null> {
  return prisma.location.findUnique({ where: { id } });
}

export async function findLocations(
  filters: LocationFilters,
  pagination: OffsetPagination,
): Promise<{ items: Location[]; total: number }> {
  const where = buildWhereClause(filters);

  const [items, total] = await Promise.all([
    prisma.location.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.location.count({ where }),
  ]);

  return { items, total };
}

export function updateLocation(
  id: string,
  data: Partial<{ name: string; category: LocationCategory; isActive: boolean }>,
): Promise<Location> {
  return prisma.location.update({ where: { id }, data });
}

// Used to enforce the Administration Office singleton before an insert or
// category change reaches the database's own partial unique index (see
// PROJECT_RULES.md) — this turns what would otherwise be a raw constraint
// violation into a clear, intentional 409 from the service layer.
export function countLocationsByCategory(category: LocationCategory): Promise<number> {
  return prisma.location.count({ where: { category } });
}
