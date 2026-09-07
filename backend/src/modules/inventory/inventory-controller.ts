import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler";
import { sendSuccess } from "../../shared/utils/response";
import { UnauthorizedError } from "../../shared/errors/app-error";
import * as inventoryService from "./inventory-service";
import type {
  DistributeInventoryInput,
  GetInventoryQuery,
  InitializeInventoryInput,
  InventoryIdParam,
  TrashInventoryInput,
} from "./inventory-schema";

export const getInventory = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    // Unreachable in practice — authenticateRequest runs first on every
    // route in this module. Guards against this handler ever being wired
    // up without it.
    throw new UnauthorizedError();
  }

  const query = req.validatedQuery as GetInventoryQuery;
  const result = await inventoryService.getInventory(query, req.user);
  sendSuccess(res, result, "Inventory retrieved successfully");
});

export const initializeInventory = asyncHandler(async (req: Request, res: Response) => {
  const inventory = await inventoryService.initializeInventory(req.body as InitializeInventoryInput);
  sendSuccess(res, inventory, "Inventory initialized successfully", 201);
});

export const distributeInventory = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  const { id } = req.params as unknown as InventoryIdParam;
  const inventory = await inventoryService.distributeInventory(
    id,
    req.body as DistributeInventoryInput,
    req.user,
  );
  sendSuccess(res, inventory, "Inventory distributed successfully");
});

export const trashInventory = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  const { id } = req.params as unknown as InventoryIdParam;
  const inventory = await inventoryService.trashInventory(
    id,
    req.body as TrashInventoryInput,
    req.user,
  );
  sendSuccess(res, inventory, "Inventory trashed successfully");
});
