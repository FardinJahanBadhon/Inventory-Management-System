import type { NextFunction, Request, Response } from "express";

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

// Wraps an async route/controller handler so a rejected promise reaches the
// centralized error handler via next(), instead of becoming an unhandled
// rejection that hangs the request or crashes the process.
export function asyncHandler(handler: AsyncRequestHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}
