import { z } from "zod";
import { LocationCategory } from "@prisma/client";
import { paginationQuerySchema } from "../../shared/utils/pagination";

export const createLocationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  category: z.enum(LocationCategory),
  isActive: z.boolean().default(true),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;

// Every field optional (it's a PATCH), but at least one must actually be
// present — an empty body is a client error, not a no-op success.
export const updateLocationSchema = z
  .object({
    name: z.string().trim().min(1, "Name cannot be empty").max(200).optional(),
    category: z.enum(LocationCategory).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field (name, category, isActive) must be provided",
  });

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

export const locationIdParamSchema = z.object({
  id: z.string().uuid("Invalid location id"),
});

export type LocationIdParam = z.infer<typeof locationIdParamSchema>;

export const getLocationsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(200).optional(),
  category: z.enum(LocationCategory).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export type GetLocationsQuery = z.infer<typeof getLocationsQuerySchema>;
