import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/utils/async-handler";
import { sendSuccess } from "../../shared/utils/response";
import { UnauthorizedError } from "../../shared/errors/app-error";
import { getAuthenticatedUserProfile, loginWithCredentials } from "./auth-service";
import type { LoginInput } from "./auth-schema";

export const login = asyncHandler(async (req: Request, res: Response) => {
  // req.body was already parsed/validated by validateRequest(loginSchema)
  // in auth-routes.ts before this handler runs.
  const result = await loginWithCredentials(req.body as LoginInput);
  sendSuccess(res, result, "Login successful");
});

export const getAuthenticatedUser = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    // Unreachable in practice — authenticateRequest runs first on this
    // route and would already have rejected the request. Guards against
    // this handler ever being wired up without that middleware.
    throw new UnauthorizedError();
  }

  const profile = await getAuthenticatedUserProfile(req.user);
  sendSuccess(res, profile, "Authenticated user retrieved");
});
