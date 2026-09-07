import { Prisma, type Product } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export interface ProductFilters {
  search?: string;
  isActive?: boolean;
}

export interface OffsetPagination {
  skip: number;
  take: number;
}

function buildWhereClause(filters: ProductFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};

  if (filters.search) {
    where.OR = [
      { code: { contains: filters.search, mode: "insensitive" } },
      { name: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  return where;
}

// isActive is fixed to true here, not accepted as a parameter — see the
// comment on createProductSchema for why creation never takes it from the
// caller.
export function createProduct(data: { code: string; name: string; unit: string }): Promise<Product> {
  return prisma.product.create({ data: { ...data, isActive: true } });
}

export function findProductById(id: string): Promise<Product | null> {
  return prisma.product.findUnique({ where: { id } });
}

// Existence-only lookup for the code-uniqueness pre-check.
export function findProductByCode(code: string): Promise<{ id: string } | null> {
  return prisma.product.findUnique({ where: { code }, select: { id: true } });
}

export async function findProducts(
  filters: ProductFilters,
  pagination: OffsetPagination,
): Promise<{ items: Product[]; total: number }> {
  const where = buildWhereClause(filters);

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.count({ where }),
  ]);

  return { items, total };
}

export function updateProduct(
  id: string,
  data: Partial<{ code: string; name: string; unit: string; isActive: boolean }>,
): Promise<Product> {
  return prisma.product.update({ where: { id }, data });
}
