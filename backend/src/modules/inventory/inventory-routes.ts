import { Router } from "express";
import { authenticateRequest } from "../../middlewares/authenticate";
import {
  requireAdministrationAccess,
  requireOperationalLocationAccess,
} from "../../middlewares/authorize";
import { validateRequest } from "../../middlewares/validate-request";
import {
  distributeInventorySchema,
  getInventoryQuerySchema,
  initializeInventorySchema,
  inventoryIdParamSchema,
  trashInventorySchema,
} from "./inventory-schema";
import {
  distributeInventory,
  getInventory,
  initializeInventory,
  trashInventory,
} from "./inventory-controller";

export const inventoryRoutes = Router();

// Unlike Locations/Users/Products, this module has no single blanket
// authorization rule for the whole router — view is open to any
// authenticated user (scoped differently per category inside the
// service), initialize is Administration-only, and distribute/trash are
// operational-only. Only authentication is common to all four routes.
inventoryRoutes.use(authenticateRequest);

inventoryRoutes.get("/", validateRequest({ query: getInventoryQuerySchema }), getInventory);

inventoryRoutes.post(
  "/initialize",
  requireAdministrationAccess,
  validateRequest({ body: initializeInventorySchema }),
  initializeInventory,
);

inventoryRoutes.post(
  "/:id/distribute",
  requireOperationalLocationAccess,
  validateRequest({ params: inventoryIdParamSchema, body: distributeInventorySchema }),
  distributeInventory,
);

inventoryRoutes.post(
  "/:id/trash",
  requireOperationalLocationAccess,
  validateRequest({ params: inventoryIdParamSchema, body: trashInventorySchema }),
  trashInventory,
);
