import { Router } from "express";
import { authenticateRequest } from "../../middlewares/authenticate";
import { requireAdministrationAccess } from "../../middlewares/authorize";
import { validateRequest } from "../../middlewares/validate-request";
import {
  createUserSchema,
  getUsersQuerySchema,
  updateUserSchema,
  userIdParamSchema,
} from "./user-schema";
import { createUser, getUserById, getUsers, updateUser } from "./user-controller";

export const userRoutes = Router();

// Every user-management endpoint is Administration-only — apply once at
// the router level rather than repeating both middlewares on every route.
userRoutes.use(authenticateRequest, requireAdministrationAccess);

userRoutes.post("/", validateRequest({ body: createUserSchema }), createUser);

userRoutes.get("/", validateRequest({ query: getUsersQuerySchema }), getUsers);

userRoutes.get("/:id", validateRequest({ params: userIdParamSchema }), getUserById);

userRoutes.patch(
  "/:id",
  validateRequest({ params: userIdParamSchema, body: updateUserSchema }),
  updateUser,
);
