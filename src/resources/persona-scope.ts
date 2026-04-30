import type { HttpClient, PaginatedResult } from "../client.js";
import type { IterateParams } from "../pagination.js";
import type { Integrations } from "./integrations.js";
import type { Memory } from "./memory.js";
import type { Personas } from "./personas.js";
import type {
  AskInput,
  AskResult,
  BuildAccepted,
  BuildPersonaInput,
  DataSourceConnection,
  ForgetInput,
  ForgetResult,
  GenerateSummaryInput,
  NamespaceTarget,
  Persona,
  PersonaBuildStatus,
  PersonaResponse,
  PersonaSummary,
  PersonaTarget,
  RecallInput,
  RecallResult,
  RememberInput,
  RememberResult,
  RequestOptions,
  StartConnectionResult,
  Target,
  UpdatePersonaInput,
} from "../types.js";

/**
 * A lightweight handle to a single persona. Persona-lifecycle and
 * integrations operations can be issued without re-stating the persona
 * target; memory operations are routed to the persona's backing namespace.
 *
 * The handle is constructed eagerly with no network call. The persona's
 * `id` and `namespace_id` are resolved (and cached) on the first operation
 * that needs them. When the scope was created by ID, persona-id ops avoid
 * the resolution fetch entirely.
 */
export class PersonaScope {
  readonly integrations: PersonaIntegrationsScope;

  /** Cached after the first metadata fetch. Holds id + namespace_id. */
  private record: PersonaResponse | undefined;

  constructor(
    private readonly http: HttpClient,
    private readonly memory: Memory,
    private readonly personas: Personas,
    private readonly integrationsTop: Integrations,
    private readonly target: PersonaTarget,
  ) {
    this.integrations = new PersonaIntegrationsScope(this.integrationsTop, this.target);
  }

  // ── Persona lifecycle ─────────────────────────────────────────────

  /** Fetches the underlying `PersonaResponse` from the API. */
  async metadata(opts?: RequestOptions): Promise<PersonaResponse> {
    if ("persona_id" in this.target && this.target.persona_id) {
      return this.personas.get(this.target.persona_id, opts);
    }
    return this.personas.getByExternalRef(this.target.external_reference_id!, opts);
  }

  async update(input: UpdatePersonaInput, opts?: RequestOptions): Promise<Persona> {
    const id = await this.resolvePersonaId(opts);
    return this.personas.update(id, input, opts);
  }

  /**
   * Deletes the underlying persona. When the scope was created by external
   * reference, this performs an extra `metadata()` call (cached) to resolve
   * the ID because the delete endpoint operates on IDs only.
   */
  async delete(opts?: RequestOptions): Promise<void> {
    const id = await this.resolvePersonaId(opts);
    return this.personas.delete(id, opts);
  }

  async build(input?: BuildPersonaInput, opts?: RequestOptions): Promise<BuildAccepted> {
    const id = await this.resolvePersonaId(opts);
    return this.personas.build(id, input, opts);
  }

  async status(opts?: RequestOptions): Promise<PersonaBuildStatus> {
    const id = await this.resolvePersonaId(opts);
    return this.personas.status(id, opts);
  }

  async getSummary(opts?: RequestOptions): Promise<PersonaSummary> {
    const id = await this.resolvePersonaId(opts);
    return this.personas.getSummary(id, opts);
  }

  async generateSummary(
    input?: GenerateSummaryInput,
    opts?: RequestOptions,
  ): Promise<PersonaSummary> {
    const id = await this.resolvePersonaId(opts);
    return this.personas.generateSummary(id, input, opts);
  }

  // ── Memory (routed through persona's namespace) ───────────────────

  remember(
    input: Omit<RememberInput, keyof NamespaceTarget>,
    opts?: RequestOptions,
  ): Promise<RememberResult> {
    return this.withNamespaceId(opts, (namespace_id) =>
      this.memory.remember({ ...input, namespace_id } as RememberInput, opts),
    );
  }

  recall(
    input: Omit<RecallInput, keyof NamespaceTarget>,
    opts?: RequestOptions,
  ): Promise<RecallResult> {
    return this.withNamespaceId(opts, (namespace_id) =>
      this.memory.recall({ ...input, namespace_id } as RecallInput, opts),
    );
  }

  ask(
    input: Omit<AskInput, keyof NamespaceTarget>,
    opts?: RequestOptions,
  ): Promise<AskResult> {
    return this.withNamespaceId(opts, (namespace_id) =>
      this.memory.ask({ ...input, namespace_id } as AskInput, opts),
    );
  }

  forget(
    input: Omit<ForgetInput, keyof NamespaceTarget>,
    opts?: RequestOptions,
  ): Promise<ForgetResult> {
    return this.withNamespaceId(opts, (namespace_id) =>
      this.memory.forget({ ...input, namespace_id } as ForgetInput, opts),
    );
  }

  // ── Resolution helpers ────────────────────────────────────────────

  private async resolvePersonaId(opts?: RequestOptions): Promise<string> {
    if ("persona_id" in this.target && this.target.persona_id) {
      return this.target.persona_id;
    }
    return (await this.ensureRecord(opts)).id;
  }

  private async withNamespaceId<T>(
    opts: RequestOptions | undefined,
    fn: (namespace_id: string) => Promise<T>,
  ): Promise<T> {
    const record = await this.ensureRecord(opts);
    return fn(record.namespace_id);
  }

  private async ensureRecord(opts?: RequestOptions): Promise<PersonaResponse> {
    if (!this.record) {
      this.record = await this.metadata(opts);
    }
    return this.record;
  }
}

/**
 * Translate the captured `PersonaTarget` into the typed gateway `Target`
 * shape the integrations endpoints require.
 */
function personaAsTarget(target: PersonaTarget): Target {
  if ("persona_id" in target && target.persona_id) {
    return { type: "persona", id: target.persona_id };
  }
  return { type: "persona", external_reference_id: target.external_reference_id! };
}

/**
 * Integrations as exposed inside a persona scope. The persona target is
 * implicit — callers no longer pass `target` into list/start.
 */
export class PersonaIntegrationsScope {
  private readonly resolvedTarget: Target;

  constructor(
    private readonly integrations: Integrations,
    target: PersonaTarget,
  ) {
    this.resolvedTarget = personaAsTarget(target);
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
