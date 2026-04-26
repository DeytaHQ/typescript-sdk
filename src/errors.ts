export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "BAD_GATEWAY"
  | "SERVICE_UNAVAILABLE"
  | "GATEWAY_TIMEOUT";

/**
 * Thrown when the API returns an error envelope or a non-2xx status.
 * Surfaces the upstream `code`, `status`, and `message` so callers can
 * branch on either the typed code or HTTP status.
 */
export class DeytaError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status: number) {
    super(message);
    this.name = "DeytaError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Thrown when the request fails before reaching the API — network failure,
 * DNS error, abort/timeout. The original error (if any) is on `cause`.
 */
export class DeytaConnectionError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "DeytaConnectionError";
    this.cause = cause;
  }
}
