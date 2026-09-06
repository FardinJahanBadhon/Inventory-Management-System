import type { NextFunction, Request, Response } from "express";
import { LocationCategory } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "../shared/errors/app-error";

// Coarse, route-level authorization by location category. This is the
// reusable foundation only — per-resource ownership checks (e.g. "does this
// Inventory row belong to req.user.locationId") belong in each module's
// service layer once that module exists (Phase 9 for inventory), per the
// two-layer authorization model in PROJECT_RULES.md / Phase 1 §5.
//
// Both functions assume authenticateRequest has already run and populated
// req.user; they fail closed (401) if it hasn't, rather than assuming
// authorization implies authentication.

export function requireAdministrationAccess(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new UnauthorizedError());
    return;
  }

  if (req.user.locationCategory !== LocationCategory.ADMINISTRATION) {
    next(new ForbiddenError("This action requires Administration access"));
    return;
  }

  next();
}

export function requireOperationalLocationAccess(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new UnauthorizedError());
    return;
  }

  if (req.user.locationCategory === LocationCategory.ADMINISTRATION) {
    next(new ForbiddenError("This action is not available to Administration users"));
    return;
  }

  next();
}
