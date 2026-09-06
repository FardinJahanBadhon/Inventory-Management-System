import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../shared/errors/app-error";
import { ERROR_CODES } from "../shared/errors/error-codes";
import { logger } from "../shared/utils/logger";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: { code: err.code },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      message: "Request validation failed",
      error: { code: ERROR_CODES.VALIDATION_ERROR, details: err.flatten() },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // https://www.prisma.io/docs/orm/reference/error-reference
    if (err.code === "P2002") {
      res.status(409).json({
        success: false,
        message: "A record with this value already exists",
        error: { code: ERROR_CODES.CONFLICT },
      });
      return;
    }

    if (err.code === "P2025") {
      res.status(404).json({
        success: false,
        message: "Resource not found",
        error: { code: ERROR_CODES.NOT_FOUND },
      });
      return;
    }

    if (err.code === "P2003") {
      res.status(400).json({
        success: false,
        message: "Request references a record that does not exist",
        error: { code: ERROR_CODES.BAD_REQUEST },
      });
      return;
    }
  }

  // Anything else is unexpected: log the full detail server-side only, and
  // never let it leak into the response body.
  logger.error("Unhandled error", {
    path: req.path,
    method: req.method,
    error: err instanceof Error ? err.stack : err,
  });

  res.status(500).json({
    success: false,
    message: "An unexpected error occurred",
    error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR },
  });
}
