import { z } from "zod";
import { paginationQuerySchema } from "../../shared/utils/pagination";

export const inventoryIdParamSchema = z.object({
  id: z.string().uuid("Invalid inventory id"),
});

export type InventoryIdParam = z.infer<typeof inventoryIdParamSchema>;

// Shared by Initialize, Distribute, and Trash — all three require a
// strictly positive integer quantity. Since these are JSON bodies (not
// query strings), Zod's plain z.number() already rejects "10", "abc", etc.
// without needing coercion.
const positiveQuantitySchema = z
  .number("Quantity is required")
  .int("Quantity must be a whole number")
  .positive("Quantity must be greater than zero");

export const initializeInventorySchema = z.object({
  productId: z.string().uuid("Invalid product id"),
  locationId: z.string().uuid("Invalid location id"),
  quantity: positiveQuantitySchema,
});

export type InitializeInventoryInput = z.infer<typeof initializeInventorySchema>;

export const distributeInventorySchema = z.object({
  quantity: positiveQuantitySchema,
});

export type DistributeInventoryInput = z.infer<typeof distributeInventorySchema>;

export const trashInventorySchema = z.object({
  quantity: positiveQuantitySchema,
});

export type TrashInventoryInput = z.infer<typeof trashInventorySchema>;

// locationId/productId are both optional filters. For an ADMINISTRATION
// caller, locationId (if present) scopes the results to one location;
// for an operational caller, it is validated here (so a malformed value
// still gets a clean 422) but then IGNORED by inventory-service.ts, which
// always forces the scope to the authenticated user's own location.
export const getInventoryQuerySchema = paginationQuerySchema.extend({
  locationId: z.string().uuid("Invalid location id").optional(),
  productId: z.string().uuid("Invalid product id").optional(),
});

export type GetInventoryQuery = z.infer<typeof getInventoryQuerySchema>;
