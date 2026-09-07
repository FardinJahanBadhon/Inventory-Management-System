import { Prisma, type LocationCategory } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export interface UserFilters {
  search?: string;
  locationId?: string;
  isActive?: boolean;
}

export interface OffsetPagination {
  skip: number;
  take: number;
}

// Deliberately excludes passwordHash — every function here backs a
// user-management response (create/list/get/update), never login. See
// modules/auth/auth-repository.ts for the separate, auth-specific queries
// that do select the hash; PROJECT_RULES.md documents why the two stay
// apart rather than being merged into one repository.
const userWithLocationSelect = {
  id: true,
  name: true,
  username: true,
  locationId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  location: {
    select: { id: true, name: true, category: true, isActive: true },
  },
} as const;

export type UserWithLocation = Prisma.UserGetPayload<{ select: typeof userWithLocationSelect }>;

function buildWhereClause(filters: UserFilters): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { username: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters.locationId) {
    where.locationId = filters.locationId;
  }

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  return where;
}

export function createUser(data: {
  name: string;
  username: string;
  passwordHash: string;
  locationId: string;
  isActive: boolean;
}): Promise<UserWithLocation> {
  return prisma.user.create({ data, select: userWithLocationSelect });
}

export function findUserById(id: string): Promise<UserWithLocation | null> {
  return prisma.user.findUnique({ where: { id }, select: userWithLocationSelect });
}

// Existence-only lookup for the username-uniqueness pre-check — no reason
// to select anything beyond `id`.
export function findUserByUsername(username: string): Promise<{ id: string } | null> {
  return prisma.user.findUnique({ where: { username }, select: { id: true } });
}

export async function findUsers(
  filters: UserFilters,
  pagination: OffsetPagination,
): Promise<{ items: UserWithLocation[]; total: number }> {
  const where = buildWhereClause(filters);

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { createdAt: "desc" },
      select: userWithLocationSelect,
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total };
}

export function updateUser(
  id: string,
  data: Partial<{
    name: string;
    username: string;
    passwordHash: string;
    locationId: string;
    isActive: boolean;
  }>,
): Promise<UserWithLocation> {
  return prisma.user.update({ where: { id }, data, select: userWithLocationSelect });
}

// Backs the "at least one active Administration user must exist" invariant
// in user-service.ts — counts active users whose assigned location has the
// given category, optionally excluding one user (the one being updated).
export function countActiveUsersByLocationCategory(
  category: LocationCategory,
  excludeUserId?: string,
): Promise<number> {
  return prisma.user.count({
    where: {
      isActive: true,
      location: { category },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}
