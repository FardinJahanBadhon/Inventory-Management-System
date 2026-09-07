import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { SerializedError } from "@reduxjs/toolkit";

// Mirrors backend/src/shared/types/api.ts's ApiErrorResponse — the
// `{ success: false, message, error: { code, details? } }` envelope every
// endpoint returns on failure.
interface BackendErrorPayload {
  success: false;
  message: string;
  error: {
    code: string;
    details?: unknown;
  };
}

function isBackendErrorPayload(data: unknown): data is BackendErrorPayload {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>).success === false &&
    typeof (data as Record<string, unknown>).error === "object"
  );
}

export type ApiErrorKind =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "server"
  | "network"
  | "unknown";

// A normalized shape every future feature module can branch on, instead of
// each component re-parsing RTK Query's FetchBaseQueryError union itself.
export interface ApiError {
  kind: ApiErrorKind;
  message: string;
  code?: string;
  details?: unknown;
}

function kindForStatus(status: number): ApiErrorKind {
  switch (status) {
    case 400:
    case 422:
      return "validation";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not-found";
    case 409:
      return "conflict";
    default:
      return status >= 500 ? "server" : "unknown";
  }
}

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

// Normalizes anything RTK Query can hand back from a failed query/mutation
// (`error` field of its result) into one shape the UI can rely on. Never
// forwards a raw backend stack trace — only `message`/`code`/`details` from
// the backend's own error envelope, or a generic fallback.
export function toApiError(
  error: FetchBaseQueryError | SerializedError | undefined | null,
): ApiError {
  if (!error) {
    return { kind: "unknown", message: FALLBACK_MESSAGE };
  }

  if ("status" in error) {
    // Network-layer failure — no HTTP response was ever received.
    if (typeof error.status === "string") {
      if (error.status === "FETCH_ERROR") {
        return {
          kind: "network",
          message: "Could not reach the server. Check your connection and try again.",
        };
      }
      if (error.status === "TIMEOUT_ERROR") {
        return { kind: "network", message: "The request timed out. Please try again." };
      }
      return { kind: "unknown", message: FALLBACK_MESSAGE };
    }

    // A real HTTP response came back.
    const kind = kindForStatus(error.status);
    if (isBackendErrorPayload(error.data)) {
      return {
        kind,
        message: error.data.message,
        code: error.data.error.code,
        details: error.data.error.details,
      };
    }
    return { kind, message: FALLBACK_MESSAGE };
  }

  // SerializedError — a plain JS error thrown outside the HTTP layer.
  return { kind: "unknown", message: error.message ?? FALLBACK_MESSAGE };
}

export function getApiErrorMessage(
  error: FetchBaseQueryError | SerializedError | undefined | null,
): string {
  return toApiError(error).message;
}
