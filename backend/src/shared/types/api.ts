import type { ErrorCode } from "../errors/error-codes";

// The single response shape every endpoint in this API uses, success or
// failure, so clients never need to branch on which endpoint they called
// to know where to look for the payload vs. the error.
export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  error: {
    code: ErrorCode;
    details?: unknown;
  };
}
