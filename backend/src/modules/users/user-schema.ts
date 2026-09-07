import { z } from "zod";
import { paginationQuerySchema } from "../../shared/utils/pagination";

// Not specified by the source requirements beyond "unique" — this is a
// reasonable, minimal input-hygiene default (no whitespace/control
// characters, sane length bounds), not an invented business rule.
const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(50, "Username must be at most 50 characters")
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "Username may only contain letters, numbers, dots, underscores, and hyphens",
  );

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  username: usernameSchema,
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  locationId: z.string().uuid("Invalid location id"),
  isActive: z.boolean().default(true),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// Every field optional (PATCH semantics), but at least one must be present.
// `id`, `passwordHash`, `createdAt`, `updatedAt` are never accepted here —
// there is no path through which a client can set them directly.
export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1, "Name cannot be empty").max(200).optional(),
    username: usernameSchema.optional(),
    password: z.string().min(8, "Password must be at least 8 characters").max(200).optional(),
    locationId: z.string().uuid("Invalid location id").optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field (name, username, password, locationId, isActive) must be provided",
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userIdParamSchema = z.object({
  id: z.string().uuid("Invalid user id"),
});

export type UserIdParam = z.infer<typeof userIdParamSchema>;

export const getUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(200).optional(),
  locationId: z.string().uuid("Invalid location id").optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>;
