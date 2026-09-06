import type { Response } from "express";

// The one place that shapes a successful response body. Error responses are
// shaped centrally too, in src/middlewares/error-handler.ts — together
// these two are the only places in the codebase allowed to write
// `{ success, message, ... }` directly.
export function sendSuccess<T>(
  res: Response,
  data: T,
  message = "Operation successful",
  statusCode = 200,
): void {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}
