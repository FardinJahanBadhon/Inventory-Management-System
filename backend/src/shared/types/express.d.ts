import type { AuthenticatedUser } from "./auth";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;

      // Set by validateRequest() when a route defines a `query` schema.
      // req.query itself cannot hold this: Express 5's req.query has no
      // setter and is re-parsed fresh from the URL on every access (see
      // src/middlewares/validate-request.ts for why). Each route's
      // controller is expected to know its own query shape and cast this
      // accordingly, e.g. `req.validatedQuery as GetInventoryQuery`.
      validatedQuery?: unknown;
    }
  }
}

export {};
