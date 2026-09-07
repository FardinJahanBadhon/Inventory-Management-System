import type { Product } from "@prisma/client";
import { ConflictError, NotFoundError } from "../../shared/errors/app-error";
import type { PaginatedData } from "../../shared/types/api";
import { buildPaginationMeta, toSkipTake } from "../../shared/utils/pagination";
import {
  createProduct as createProductRecord,
  findProductByCode,
  findProductById,
  findProducts as findProductRecords,
  updateProduct as updateProductRecord,
} from "./product-repository";
import type { CreateProductInput, GetProductsQuery, UpdateProductInput } from "./product-schema";
import type { ProductResponse } from "./product-types";

function toProductResponse(product: Product): ProductResponse {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    unit: product.unit,
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

// A pre-check for a clear, intentional 409 — the database's own unique
// constraint on `code` remains the final protection against a race between
// two concurrent create/update requests (Phase 4's error handler already
// maps that raw constraint violation to a generic 409 if it's ever hit).
async function assertCodeAvailable(code: string, excludeProductId?: string): Promise<void> {
  const existing = await findProductByCode(code);

  if (existing && existing.id !== excludeProductId) {
    throw new ConflictError("This product code is already in use");
  }
}

export async function createProduct(input: CreateProductInput): Promise<ProductResponse> {
  await assertCodeAvailable(input.code);

  const created = await createProductRecord(input);
  return toProductResponse(created);
}

export async function getProducts(query: GetProductsQuery): Promise<PaginatedData<ProductResponse>> {
  const { skip, take } = toSkipTake(query.page, query.pageSize);

  const { items, total } = await findProductRecords(
    { search: query.search, isActive: query.isActive },
    { skip, take },
  );

  return {
    items: items.map(toProductResponse),
    meta: buildPaginationMeta(total, query.page, query.pageSize),
  };
}

export async function getProductById(id: string): Promise<ProductResponse> {
  const product = await findProductById(id);

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  return toProductResponse(product);
}

// No analogous "singleton" invariant exists for Product (unlike the
// Administration Office / last-active-admin rules in Locations and Users)
// — deactivating or renaming a product has no system-wide side effect
// beyond the product row itself, so no additional protection is needed
// here beyond the code-uniqueness check.
export async function updateProduct(id: string, input: UpdateProductInput): Promise<ProductResponse> {
  const existing = await findProductById(id);

  if (!existing) {
    throw new NotFoundError("Product not found");
  }

  if (input.code !== undefined && input.code !== existing.code) {
    await assertCodeAvailable(input.code, id);
  }

  const updated = await updateProductRecord(id, input);
  return toProductResponse(updated);
}
