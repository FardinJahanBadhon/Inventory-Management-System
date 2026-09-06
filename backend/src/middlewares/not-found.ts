import type { Request, Response } from "express";
import { ERROR_CODES } from "../shared/errors/error-codes";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} does not exist`,
    error: { code: ERROR_CODES.NOT_FOUND },
  });
}
