import { MemoryLakeError, MemoryLakeNetworkError } from "./errors.js";
import type {
  ErrorResponseBody,
  Pagination,
  PaginatedResponse,
  RequestOptions,
  SuccessResponse,
} from "./types.js";

export interface DeyaConfig {
  /** API key for authentication (Bearer token) */
  apiKey: string;
  /** Base URL of the Deyta API (e.g. "https://api.deyta.ai") */
  baseUrl: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: Pagination;
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor(config: DeyaConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "") + "/gateway/v1";
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 30_000;
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
      const err = json as ErrorResponseBody;
      throw new MemoryLakeError(err.error.code, err.error.message, err.error.status);
    }

    const paginated = json as PaginatedResponse<T>;
    return { data: paginated.data, pagination: paginated.pagination };
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
      const err = json as ErrorResponseBody;
      throw new MemoryLakeError(err.error.code, err.error.message, err.error.status);
    }

    return (json as SuccessResponse<T>).data;
  }

  private async rawRequest(
    method: string,
    path: string,
    body?: unknown,
    opts?: RequestOptions,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.apiKey}`,
      };

      if (body !== undefined) {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: opts?.signal ?? controller.signal,
      });

      if (!response.ok && response.status !== 204) {
        try {
          const json = (await response.json()) as ErrorResponseBody;
          if (json.error) {
            throw new MemoryLakeError(json.error.code, json.error.message, json.error.status);
          }
        } catch (parseError) {
          if (parseError instanceof MemoryLakeError) throw parseError;
          throw new MemoryLakeError(
            "INTERNAL_ERROR",
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
          );
        }
      }

      return response;
    } catch (error) {
      if (error instanceof MemoryLakeError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new MemoryLakeNetworkError("Request timed out");
      }
      throw new MemoryLakeNetworkError("Network request failed", error);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/** Build a query string from an object, omitting undefined values */
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
