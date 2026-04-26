import type { HttpClient } from "../client.js";
import type { Integrations } from "./integrations.js";
import type { Memory } from "./memory.js";
import type { Namespaces } from "./namespaces.js";
import type {
  AskInput,
  AskResult,
  CompleteConnectionInput,
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
  StartConnectionInput,
  StartConnectionResult,
} from "../types.js";

/**
 * A lightweight handle to a single namespace. All memory, persona, and
 * integration ops can be issued without re-stating the namespace target.
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
    return this.namespaces.getByExternalRef(this.target.external_reference_id!, opts);
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
 * Integrations as exposed inside a namespace scope. The namespace target
 * is implicit — callers no longer pass `namespace_id` / `external_reference_id`
 * into list/start.
 */
export class NamespaceIntegrationsScope {
  constructor(
    private readonly integrations: Integrations,
    private readonly target: NamespaceTarget,
  ) {}

  list(opts?: RequestOptions): Promise<DataSourceConnection[]> {
    return this.integrations.listConnections(this.target, opts);
  }

  start(
    input: Omit<StartConnectionInput, keyof NamespaceTarget>,
    opts?: RequestOptions,
  ): Promise<StartConnectionResult> {
    return this.integrations.startConnection(
      { ...input, ...this.target } as StartConnectionInput,
      opts,
    );
  }

  /** Connection-scoped — does not require a namespace target. */
  get(id: string, opts?: RequestOptions): Promise<DataSourceConnection> {
    return this.integrations.getConnection(id, opts);
  }

  /** Connection-scoped — does not require a namespace target. */
  complete(
    input: CompleteConnectionInput,
    opts?: RequestOptions,
  ): Promise<DataSourceConnection> {
    return this.integrations.completeConnection(input, opts);
  }

  /** Connection-scoped — does not require a namespace target. */
  delete(id: string, opts?: RequestOptions): Promise<void> {
    return this.integrations.deleteConnection(id, opts);
  }
}
