import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler";
import { sendSuccess } from "../../shared/utils/response";
import * as locationService from "./location-service";
import type {
  CreateLocationInput,
  GetLocationsQuery,
  LocationIdParam,
  UpdateLocationInput,
} from "./location-schema";

export const createLocation = asyncHandler(async (req: Request, res: Response) => {
  const location = await locationService.createLocation(req.body as CreateLocationInput);
  sendSuccess(res, location, "Location created successfully", 201);
});

export const getLocations = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery as GetLocationsQuery;
  const result = await locationService.getLocations(query);
  sendSuccess(res, result, "Locations retrieved successfully");
});

export const getLocationById = asyncHandler(async (req: Request, res: Response) => {
  // req.params was already validated/replaced by validateRequest(locationIdParamSchema)
  // in location-routes.ts; Express's own ParamsDictionary type is looser
  // (string | string[] | undefined) to accommodate wildcard routes, hence the cast.
  const { id } = req.params as unknown as LocationIdParam;
  const location = await locationService.getLocationById(id);
  sendSuccess(res, location, "Location retrieved successfully");
});

export const updateLocation = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as unknown as LocationIdParam;
  const location = await locationService.updateLocation(id, req.body as UpdateLocationInput);
  sendSuccess(res, location, "Location updated successfully");
});
