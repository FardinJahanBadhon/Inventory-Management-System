import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler";
import { sendSuccess } from "../../shared/utils/response";
import * as userService from "./user-service";
import type {
  CreateUserInput,
  GetUsersQuery,
  UpdateUserInput,
  UserIdParam,
} from "./user-schema";

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body as CreateUserInput);
  sendSuccess(res, user, "User created successfully", 201);
});

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery as GetUsersQuery;
  const result = await userService.getUsers(query);
  sendSuccess(res, result, "Users retrieved successfully");
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as unknown as UserIdParam;
  const user = await userService.getUserById(id);
  sendSuccess(res, user, "User retrieved successfully");
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as unknown as UserIdParam;
  const user = await userService.updateUser(id, req.body as UpdateUserInput);
  sendSuccess(res, user, "User updated successfully");
});
