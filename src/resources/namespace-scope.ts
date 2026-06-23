import type { HttpClient, PaginatedResult } from "../client.js";
import type { IterateParams } from "../pagination.js";
import type { Integrations } from "./integrations.js";
import type { Memory } from "./memory.js";
import type { Namespaces } from "./namespaces.js";
import type {
  AskInput,
  AskResult,
  DataSourceConnection,
  ForgetInput,
  ForgetResult,
  Namespace,
  NamespaceTarget,
  RecallInput,
  RecallResult,
  RememberInput,
  RememberResult,
  RequestOptions,
  StartConnectionResult,
  Target,
} from "../types.js";

/**
 * A lightweight handle to a single namespace. All memory and integration ops
 * can be issued without re-stating the namespace target.
 *
 * The handle is constructed eagerly with no network call. `metadata()`
 * fetches the underlying `Namespace` on demand.
 */
export class NamespaceScope {
  readonly integrations: NamespaceIntegrationsScope;

  constructor(
    private readonly http: HttpClient,
    private readonly memory: Memory,
    private readonly namespaces: Namespaces,
    private readonly integrationsTop: Integrations,
    private readonly target: NamespaceTarget,
  ) {
    this.integrations = new NamespaceIntegrationsScope(this.integrationsTop, this.target);
  }

  // ── Memory ────────────────────────────────────────────────────────

  remember(
    input: Omit<RememberInput, keyof NamespaceTarget>,
    opts?: RequestOptions,
  ): Promise<RememberResult> {
    return this.memory.remember({ ...input, ...this.target } as RememberInput, opts);
  }

  recall(
    input: Omit<RecallInput, keyof NamespaceTarget>,
    opts?: RequestOptions,
  ): Promise<RecallResult> {
    return this.memory.recall({ ...input, ...this.target } as RecallInput, opts);
  }

  ask(
    input: Omit<AskInput, keyof NamespaceTarget>,
    opts?: RequestOptions,
  ): Promise<AskResult> {
    return this.memory.ask({ ...input, ...this.target } as AskInput, opts);
  }

  forget(
    input: Omit<ForgetInput, keyof NamespaceTarget>,
    opts?: RequestOptions,
  ): Promise<ForgetResult> {
    return this.memory.forget({ ...input, ...this.target } as ForgetInput, opts);
  }

  // ── Namespace lifecycle ───────────────────────────────────────────

  /** Fetches the underlying `Namespace` from the API. */
  async metadata(opts?: RequestOptions): Promise<Namespace> {
    if ("namespace_id" in this.target && this.target.namespace_id) {
      return this.namespaces.get(this.target.namespace_id, opts);
    }
    return this.namespaces.getByExternalRef(this.target.external_id!, opts);
  }

  /**
   * Deletes the underlying namespace. When the scope was created by external
   * reference, this performs an extra `metadata()` call to resolve the ID
   * because the delete endpoint operates on IDs only.
   */
  async delete(opts?: RequestOptions): Promise<void> {
    const id =
      "namespace_id" in this.target && this.target.namespace_id
        ? this.target.namespace_id
        : (await this.metadata(opts)).id;
    return this.namespaces.delete(id, opts);
  }
}

/**
 * Translate the captured `NamespaceTarget` into the typed gateway `Target`
 * shape the integrations endpoints now require.
 */
function namespaceAsTarget(target: NamespaceTarget): Target {
  if ("namespace_id" in target && target.namespace_id) {
    return { type: "namespace", id: target.namespace_id };
  }
  return { type: "namespace", external_id: target.external_id! };
}

/**
 * Integrations as exposed inside a namespace scope. The namespace target is
 * implicit — callers no longer pass `target` into list/start.
 */
export class NamespaceIntegrationsScope {
  private readonly resolvedTarget: Target;

  constructor(
    private readonly integrations: Integrations,
    target: NamespaceTarget,
  ) {
    this.resolvedTarget = namespaceAsTarget(target);
  }

  list(
    params?: { page?: number; page_size?: number },
    opts?: RequestOptions,
  ): Promise<PaginatedResult<DataSourceConnection>> {
    return this.integrations.listConnections({ ...this.resolvedTarget, ...params }, opts);
  }

  iterate(
    params?: IterateParams,
    opts?: RequestOptions,
  ): AsyncGenerator<DataSourceConnection, void, void> {
    return this.integrations.iterateConnections(this.resolvedTarget, params, opts);
  }

  start(input: { provider: string }, opts?: RequestOptions): Promise<StartConnectionResult> {
    return this.integrations.startConnection(
      { target: this.resolvedTarget, provider: input.provider },
      opts,
    );
  }

  /** Connection-scoped — does not require a target. */
  get(id: string, opts?: RequestOptions): Promise<DataSourceConnection> {
    return this.integrations.getConnection(id, opts);
  }

  /** Connection-scoped — does not require a target. */
  delete(id: string, opts?: RequestOptions): Promise<void> {
    return this.integrations.deleteConnection(id, opts);
  }
}
