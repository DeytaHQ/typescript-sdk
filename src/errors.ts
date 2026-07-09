export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "BAD_GATEWAY"
  | "SERVICE_UNAVAILABLE"
  | "GATEWAY_TIMEOUT"
  // Returned when a request supplies both a `filter` and the legacy
  // `from`/`until` time bounds — they are mutually exclusive, regardless of
  // which fields the filter constrains.
  | "FILTER_TIME_PARAMS_CONFLICT";

/** A single field-level validation failure from the API error envelope. */
export interface FieldError {
  /** Dot-path to the offending field (e.g. `filter.occurred_at`). */
  path: string;
  /** Machine-readable sub-code for this field error. */
  code: string;
  /** Human-readable reason. */
  message: string;
  /** Allowed values when the failure is an enum/whitelist violation; null otherwise. */
  allowed: string[] | null;
}

/**
 * Thrown when the API returns an error envelope or a non-2xx status.
 * Surfaces the upstream `code`, `status`, and `message` so callers can
 * branch on either the typed code or HTTP status.
 */
export class DeytaError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** Per-field validation failures, when the envelope carried any. */
  readonly errors?: FieldError[];

  constructor(code: ErrorCode, message: string, status: number, errors?: FieldError[]) {
    super(message);
    this.name = "DeytaError";
    this.code = code;
    this.status = status;
    this.errors = errors;
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
