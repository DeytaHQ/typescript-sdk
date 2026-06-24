import { DeytaError, DeytaConnectionError, type ErrorCode } from "./errors.js";
import type {
  ErrorResponseBody,
  Pagination,
  PaginatedResponse,
  RequestOptions,
  SuccessResponse,
} from "./types.js";
import { buildUserAgent } from "./user-agent.js";

const DEFAULT_BASE_URL = "https://api.deyta.ai";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_STATUSES: ReadonlyArray<number> = [408, 429, 500, 502, 503, 504];

export interface RetryConfig {
  /** Max number of retries after the initial attempt. Default: 2. Set 0 to disable. */
  maxRetries?: number;
  /** First backoff in ms. Default: 500. Doubles each attempt with jitter. */
  initialBackoffMs?: number;
  /** Cap for exponential backoff in ms. Default: 8_000. */
  maxBackoffMs?: number;
  /** HTTP statuses that trigger a retry. Default: [408, 429, 500, 502, 503, 504]. */
  retryOn?: number[];
}

export type SdkLogEvent =
  | { type: "request"; method: string; url: string; attempt: number }
  | { type: "response"; method: string; url: string; status: number; durationMs: number; attempt: number }
  | { type: "retry"; method: string; url: string; attempt: number; backoffMs: number; reason: string }
  | { type: "error"; method: string; url: string; error: Error; attempt: number };

export type SdkLogger = (event: SdkLogEvent) => void;

export interface DeytaConfig {
  /** API key for authentication (Bearer token). Optional for local servers. */
  apiKey?: string;
  /**
   * Base URL of the Deyta API. Resolution order:
   *   1. Explicit `baseUrl` passed here
   *   2. `process.env.DEYTA_BASE_URL` (read once at construction — load env
   *      vars before instantiating the client; a whitespace-only value
   *      logs a `console.warn` and falls through to the default)
   *   3. `https://api.deyta.ai`
   */
  baseUrl?: string;
  /** Request timeout in ms. Default: 30_000. */
  timeout?: number;
  /** Retry configuration. Default: 2 retries with exponential backoff. */
  retries?: RetryConfig;
  /**
   * Optional fetch implementation. Useful for tests or runtimes that need
   * a custom fetch. Falls back to `globalThis.fetch`.
   */
  fetch?: typeof fetch;
  /** Optional logger for SDK events. No-op by default. */
  logger?: SdkLogger;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: Pagination;
}

interface ResolvedRetryConfig {
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  retryOn: ReadonlyArray<number>;
}

export class HttpClient {
  private readonly rawBaseUrl: string;
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeout: number;
  private readonly retry: ResolvedRetryConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly logger?: SdkLogger;
  private readonly userAgent: string;

  constructor(config: DeytaConfig) {
    const base = resolveBaseUrl(config.baseUrl).replace(/\/+$/, "");
    this.rawBaseUrl = base;
    this.baseUrl = `${base}/api/v1`;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;
    this.retry = resolveRetryConfig(config.retries);
    this.fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.logger = config.logger;
    this.userAgent = buildUserAgent();
  }

  async get<T>(path: string, opts?: RequestOptions): Promise<T> {
    return this.request<T>("GET", path, undefined, opts);
  }

  async post<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return this.request<T>("POST", path, body, opts);
  }

  async delete(path: string, opts?: RequestOptions): Promise<void> {
    await this.rawRequest("DELETE", path, undefined, opts);
  }

  async getPaginated<T>(path: string, opts?: RequestOptions): Promise<PaginatedResult<T>> {
    const response = await this.rawRequest("GET", path, undefined, opts);
    const json = (await response.json()) as PaginatedResponse<T> | ErrorResponseBody;

    if (!json.success) {
      throwFromBody(json);
    }

    const paginated = json as PaginatedResponse<T>;
    return {
      data: paginated.data,
      pagination: {
        has_more: paginated.has_more ?? false,
        next_cursor: paginated.next_cursor ?? null,
      },
    };
  }

  async postRaw(path: string, body?: unknown, opts?: RequestOptions): Promise<Response> {
    return this.rawRequest("POST", path, body, opts);
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    opts?: RequestOptions,
  ): Promise<T> {
    const response = await this.rawRequest(method, path, body, opts);

    if (response.status === 204) return undefined as T;

    const json = (await response.json()) as SuccessResponse<T> | ErrorResponseBody;

    if (!json.success) {
      throwFromBody(json);
    }

    return (json as SuccessResponse<T>).data;
  }

  async rootGet<T>(path: string, opts?: RequestOptions): Promise<T> {
    const response = await this.rawRequest("GET", path, undefined, opts, this.rawBaseUrl);
    if (response.status === 204) return undefined as T;
    const json = (await response.json()) as SuccessResponse<T> | ErrorResponseBody;
    if (!json.success) {
      throwFromBody(json);
    }
    return (json as SuccessResponse<T>).data;
  }

  private async rawRequest(
    method: string,
    path: string,
    body?: unknown,
    opts?: RequestOptions,
    overrideBaseUrl?: string,
  ): Promise<Response> {
    const url = `${overrideBaseUrl ?? this.baseUrl}${path}`;
    const isRetryable = canRetry(method);
    const maxAttempts = isRetryable ? this.retry.maxRetries + 1 : 1;

    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startedAt = Date.now();
      this.logger?.({ type: "request", method, url, attempt });

      try {
        const response = await this.dispatch(method, url, body, opts);
        const durationMs = Date.now() - startedAt;
        this.logger?.({ type: "response", method, url, status: response.status, durationMs, attempt });

        if (response.ok) return response;

        // Non-2xx — decide whether to retry or surface as DeytaError.
        const shouldRetry =
          isRetryable &&
          attempt < maxAttempts &&
          this.retry.retryOn.includes(response.status);

        if (shouldRetry) {
          const backoffMs = backoffFor(attempt, this.retry, response);
          this.logger?.({
            type: "retry",
            method,
            url,
            attempt,
            backoffMs,
            reason: `HTTP ${response.status}`,
          });
          await sleep(backoffMs);
          continue;
        }

        // Non-retryable status — parse and throw.
        await throwFromResponse(response);
      } catch (err) {
        // DeytaError — let it propagate immediately, never retry on shaped API errors.
        if (err instanceof DeytaError) throw err;

        lastError = err;

        // Network or abort. AbortError when caller-cancelled is not retryable.
        if (isCallerAbort(err, opts?.signal)) {
          this.logger?.({ type: "error", method, url, error: err as Error, attempt });
          throw new DeytaConnectionError("Request aborted", err);
        }

        const isTimeout = isAbortError(err);
        if (isTimeout && attempt >= maxAttempts) {
          this.logger?.({ type: "error", method, url, error: err as Error, attempt });
          throw new DeytaConnectionError("Request timed out", err);
        }

        if (attempt >= maxAttempts || !isRetryable) {
          this.logger?.({ type: "error", method, url, error: err as Error, attempt });
          throw new DeytaConnectionError("Network request failed", err);
        }

        const backoffMs = backoffFor(attempt, this.retry, undefined);
        this.logger?.({
          type: "retry",
          method,
          url,
          attempt,
          backoffMs,
          reason: errorReason(err),
        });
        await sleep(backoffMs);
      }
    }

    // Defensive — loop should always return or throw.
    throw new DeytaConnectionError("Network request failed", lastError);
  }

  private async dispatch(
    method: string,
    url: string,
    body: unknown,
    opts?: RequestOptions,
  ): Promise<Response> {
    const timeoutMs = opts?.timeout ?? this.timeout;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

    try {
      const signals = [timeoutController.signal];
      if (opts?.signal) signals.push(opts.signal);
      const signal = signals.length === 1 ? signals[0] : AbortSignal.any(signals);

      const headers: Record<string, string> = {
        "User-Agent": this.userAgent,
        Accept: "application/json",
      };
      if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
      if (body !== undefined) headers["Content-Type"] = "application/json";

      if (opts?.headers) {
        for (const [k, v] of Object.entries(opts.headers)) {
          if (k.toLowerCase() === "authorization" && this.apiKey) continue;
          headers[k] = v;
        }
      }

      return await this.fetchImpl(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Encode a single URL path segment safely.
 *
 * `encodeURIComponent` alone leaves `.` and `..` untouched, so they would
 * still resolve as path traversal once the URL is parsed. Empty strings
 * collapse the segment and can hit a list endpoint with the caller's bearer
 * token. Reject those up front, then percent-encode everything else —
 * including `/`, `?`, `#`, and spaces — so a caller-supplied identifier
 * cannot break out of its path segment.
 */
export function seg(s: string): string {
  if (typeof s !== "string" || s.length === 0 || s === "." || s === "..") {
    throw new DeytaError(
      "BAD_REQUEST",
      `Invalid path identifier: ${JSON.stringify(s)}`,
      400,
    );
  }
  return encodeURIComponent(s);
}

/** Build a query string from an object, omitting undefined / null values. */
export function buildQuery(params: object): string {
  const entries: string[] = [];
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        entries.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
      }
    } else {
      entries.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return entries.length > 0 ? `?${entries.join("&")}` : "";
}

// ── internals ────────────────────────────────────────────────────────

function resolveBaseUrl(explicit?: string): string {
  if (explicit) return explicit;
  const raw = globalThis.process?.env?.DEYTA_BASE_URL;
  if (raw === undefined) return DEFAULT_BASE_URL;
  const trimmed = raw.trim();
  if (trimmed === "") {
    console.warn(
      `[deyta-sdk] DEYTA_BASE_URL is set but empty; falling back to ${DEFAULT_BASE_URL}.`,
    );
    return DEFAULT_BASE_URL;
  }
  return trimmed;
}

function resolveRetryConfig(cfg?: RetryConfig): ResolvedRetryConfig {
  return {
    maxRetries: cfg?.maxRetries ?? 2,
    initialBackoffMs: cfg?.initialBackoffMs ?? 500,
    maxBackoffMs: cfg?.maxBackoffMs ?? 8_000,
    retryOn: cfg?.retryOn ?? DEFAULT_RETRY_STATUSES,
  };
}

function canRetry(method: string): boolean {
  // Conservative: only auto-retry idempotent methods.
  return method === "GET" || method === "DELETE" || method === "HEAD";
}

function backoffFor(attempt: number, cfg: ResolvedRetryConfig, response?: Response): number {
  // Honor Retry-After when present — supports both seconds and HTTP-date.
  if (response) {
    const header = response.headers.get("retry-after");
    if (header) {
      const seconds = Number(header);
      if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.min(cfg.maxBackoffMs, seconds * 1_000);
      }
      const dateMs = Date.parse(header);
      if (!Number.isNaN(dateMs)) {
        return Math.min(cfg.maxBackoffMs, Math.max(0, dateMs - Date.now()));
      }
    }
  }
  const exp = cfg.initialBackoffMs * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(cfg.maxBackoffMs, exp + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
}

function isCallerAbort(err: unknown, callerSignal: AbortSignal | undefined): boolean {
  return isAbortError(err) && !!callerSignal?.aborted;
}

function errorReason(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

function throwFromBody(json: ErrorResponseBody): never {
  throw new DeytaError(json.error.code, json.error.message, json.error.status);
}

async function throwFromResponse(response: Response): Promise<never> {
  // Try to parse the standard envelope; fall back to a synthetic error.
  let body: ErrorResponseBody | undefined;
  try {
    body = (await response.json()) as ErrorResponseBody;
  } catch {
    // Fall through to synthetic.
  }
  if (body?.error) {
    throw new DeytaError(body.error.code, body.error.message, body.error.status);
  }
  throw new DeytaError(
    statusToCode(response.status),
    `HTTP ${response.status}: ${response.statusText}`,
    response.status,
  );
}

function statusToCode(status: number): ErrorCode {
  switch (status) {
    case 400: return "BAD_REQUEST";
    case 401: return "UNAUTHORIZED";
    case 403: return "FORBIDDEN";
    case 404: return "NOT_FOUND";
    case 409: return "CONFLICT";
    case 502: return "BAD_GATEWAY";
    case 503: return "SERVICE_UNAVAILABLE";
    case 504: return "GATEWAY_TIMEOUT";
    default: return "INTERNAL_ERROR";
  }
}
