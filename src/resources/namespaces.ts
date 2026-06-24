import { buildQuery, seg, type HttpClient, type PaginatedResult } from "../client.js";
import { paginate, type IterateParams } from "../pagination.js";
import type { Integrations } from "./integrations.js";
import type { Memory } from "./memory.js";
import { NamespaceScope } from "./namespace-scope.js";
import type {
  CreateNamespaceInput,
  ListNamespacesParams,
  Namespace,
  RequestOptions,
} from "../types.js";

export class Namespaces {
  constructor(
    private readonly http: HttpClient,
    private readonly memory: Memory,
    private readonly integrations: Integrations,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────

  async create(input: CreateNamespaceInput, opts?: RequestOptions): Promise<Namespace> {
    return this.http.post<Namespace>("/namespaces", input, opts);
  }

  async list(
    params?: ListNamespacesParams,
    opts?: RequestOptions,
  ): Promise<PaginatedResult<Namespace>> {
    const query = buildQuery(params ?? {});
    return this.http.getPaginated<Namespace>(`/namespaces${query}`, opts);
  }

  /**
   * Async iterator that walks every page of namespaces. Yields one
   * `Namespace` per item. Use this when you want all namespaces without
   * managing cursors yourself.
   */
  iterate(params?: IterateParams, opts?: RequestOptions): AsyncGenerator<Namespace, void, void> {
    const limit = params?.limit;
    return paginate<Namespace>((cursor) =>
      this.list({ limit, starting_after: cursor ?? undefined }, opts),
    );
  }

  async get(id: string, opts?: RequestOptions): Promise<Namespace> {
    return this.http.get<Namespace>(`/namespaces/${seg(id)}`, opts);
  }

  async getByExternalRef(externalRef: string, opts?: RequestOptions): Promise<Namespace> {
    return this.http.get<Namespace>(`/namespaces/external/${seg(externalRef)}`, opts);
  }

  async delete(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete(`/namespaces/${seg(id)}`, opts);
  }

  // ── Sub-clients ───────────────────────────────────────────────────

  /**
   * Returns a scoped sub-client for operating inside a single namespace.
   * No network call is made — the scope is a lightweight handle.
   */
  scope(id: string): NamespaceScope {
    return new NamespaceScope(
      this.http,
      this.memory,
      this,
      this.integrations,
      { namespace_id: id },
    );
  }

  /**
   * Returns a scoped sub-client identified by external reference. No network
   * call is made until the first operation runs (or `metadata()` is called).
   */
  scopeByExternalRef(externalRef: string): NamespaceScope {
    return new NamespaceScope(
      this.http,
      this.memory,
      this,
      this.integrations,
      { external_id: externalRef },
    );
  }
}
