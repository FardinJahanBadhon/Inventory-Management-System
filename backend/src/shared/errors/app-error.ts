import { ERROR_CODES, type ErrorCode } from "./error-codes";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;

  constructor(statusCode: number, code: ErrorCode, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 422 — the request body/query/params failed Zod schema validation.
export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(422, ERROR_CODES.VALIDATION_ERROR, message);
  }
}

// 400 — well-formed request that still violates a business precondition
// (e.g. distributing more than the available quantity). Distinct from
// ValidationError, which is specifically for schema-shape failures.
export class BadRequestError extends AppError {
  constructor(message = "Bad request") {
    super(400, ERROR_CODES.BAD_REQUEST, message);
  }
}

// 401 — missing, invalid, or expired authentication.
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(401, ERROR_CODES.UNAUTHORIZED, message);
  }
}

// 403 — authenticated, but not permitted to perform this action.
export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource") {
    super(403, ERROR_CODES.FORBIDDEN, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, ERROR_CODES.NOT_FOUND, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(409, ERROR_CODES.CONFLICT, message);
  }
}
