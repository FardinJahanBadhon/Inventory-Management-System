import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

interface RequestValidationSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

// Validates (and, via Zod coercion/defaults, normalizes) a request before it
// reaches any controller. A schema failure is forwarded to the centralized
// error handler, which reports it as 422 Unprocessable Entity — see
// src/middlewares/error-handler.ts.
//
// req.body and req.params are plain assignable properties, so they are
// replaced in place with the parsed result. req.query in Express 5 has no
// setter and is re-parsed fresh from the URL string on every access, so a
// validated/coerced query cannot be written back onto req.query itself —
// it is exposed instead as req.validatedQuery (see shared/types/express.d.ts).
// Read req.validatedQuery, not req.query, in any controller behind a `query`
// schema.
export function validateRequest(schemas: RequestValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.params) {
        // Zod's default Output generic is `unknown`, but Express types
        // req.params as the narrower ParamsDictionary — the assertion is
        // safe because the schema is what defines the actual expected shape.
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      if (schemas.query) {
        req.validatedQuery = schemas.query.parse(req.query);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
