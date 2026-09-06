import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../shared/errors/app-error";
import { verifyAccessToken } from "../lib/jwt";

const BEARER_PREFIX = "Bearer ";

// Establishes req.user for every downstream check. This is the ONLY place
// in the app that is allowed to set req.user, and it does so exclusively
// from a cryptographically verified JWT's claims — never from the request
// body, query string, or URL parameters. requireAdministrationAccess,
// requireOperationalLocationAccess, and every future per-resource ownership
// check all read req.user rather than re-deriving identity themselves.
export function authenticateRequest(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith(BEARER_PREFIX)) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  const token = header.slice(BEARER_PREFIX.length);

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    // Covers an invalid signature, an expired token, and a token whose
    // payload doesn't match the expected shape — all are "not authenticated"
    // from the caller's point of view.
    next(new UnauthorizedError("Invalid or expired authentication token"));
  }
}
