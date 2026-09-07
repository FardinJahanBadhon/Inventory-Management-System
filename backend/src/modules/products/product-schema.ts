import { z } from "zod";
import { paginationQuerySchema } from "../../shared/utils/pagination";

// Unlike Location/User creation, `isActive` is deliberately NOT accepted
// here — a newly created product is always active. This matches the
// explicit instruction that the server, not the client, controls
// isActive/id/createdAt/updatedAt on creation.
export const createProductSchema = z.object({
  code: z.string().trim().min(1, "Code is required").max(100),
  name: z.string().trim().min(1, "Name is required").max(200),
  unit: z.string().trim().min(1, "Unit is required").max(50),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

// Every field optional (PATCH semantics), but at least one must be present.
export const updateProductSchema = z
  .object({
    code: z.string().trim().min(1, "Code cannot be empty").max(100).optional(),
    name: z.string().trim().min(1, "Name cannot be empty").max(200).optional(),
    unit: z.string().trim().min(1, "Unit cannot be empty").max(50).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field (code, name, unit, isActive) must be provided",
  });

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productIdParamSchema = z.object({
  id: z.string().uuid("Invalid product id"),
});

export type ProductIdParam = z.infer<typeof productIdParamSchema>;

export const getProductsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(200).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export type GetProductsQuery = z.infer<typeof getProductsQuerySchema>;
