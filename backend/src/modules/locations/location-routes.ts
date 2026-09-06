import { Router } from "express";
import { authenticateRequest } from "../../middlewares/authenticate";
import { requireAdministrationAccess } from "../../middlewares/authorize";
import { validateRequest } from "../../middlewares/validate-request";
import {
  createLocationSchema,
  getLocationsQuerySchema,
  locationIdParamSchema,
  updateLocationSchema,
} from "./location-schema";
import {
  createLocation,
  getLocationById,
  getLocations,
  updateLocation,
} from "./location-controller";

export const locationRoutes = Router();

// Every location endpoint is Administration-only — apply once at the
// router level rather than repeating both middlewares on every route.
locationRoutes.use(authenticateRequest, requireAdministrationAccess);

locationRoutes.post("/", validateRequest({ body: createLocationSchema }), createLocation);

locationRoutes.get("/", validateRequest({ query: getLocationsQuerySchema }), getLocations);

locationRoutes.get(
  "/:id",
  validateRequest({ params: locationIdParamSchema }),
  getLocationById,
);

locationRoutes.patch(
  "/:id",
  validateRequest({ params: locationIdParamSchema, body: updateLocationSchema }),
  updateLocation,
);
