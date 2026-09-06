import { Router } from "express";
import { validateRequest } from "../../middlewares/validate-request";
import { authenticateRequest } from "../../middlewares/authenticate";
import { loginSchema } from "./auth-schema";
import { getAuthenticatedUser, login } from "./auth-controller";

export const authRoutes = Router();

// Public — must not require a JWT.
authRoutes.post("/login", validateRequest({ body: loginSchema }), login);

// Protected — identity comes only from the verified JWT, never from a
// client-supplied userId/locationId.
authRoutes.get("/me", authenticateRequest, getAuthenticatedUser);
