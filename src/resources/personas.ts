import { buildQuery, seg, type HttpClient, type PaginatedResult } from "../client.js";
import { paginate, type IterateParams } from "../pagination.js";
import type {
  BuildAccepted,
  CreatePersonaInput,
  GenerateSummaryInput,
  ListPersonasParams,
  Persona,
  PersonaBuildStatus,
  PersonaResponse,
  PersonaSummary,
  RequestOptions,
  UpdatePersonaInput,
} from "../types.js";

/**
 * Top-level persona resource. A persona owns a backing namespace created at
 * the same time; the persona's `id` is the handle used by every other
 * persona operation.
 */
export class Personas {
  constructor(private readonly http: HttpClient) {}

  // ── CRUD ──────────────────────────────────────────────────────────

  async create(input: CreatePersonaInput, opts?: RequestOptions): Promise<Persona> {
    return this.http.post<Persona>("/personas", input, opts);
  }

  async list(
    params?: ListPersonasParams,
    opts?: RequestOptions,
  ): Promise<PaginatedResult<Persona>> {
    const query = buildQuery(params ?? {});
    return this.http.getPaginated<Persona>(`/personas${query}`, opts);
  }

  /**
   * Async iterator that walks every page of personas. Yields one `Persona`
   * per item.
   */
  iterate(params?: IterateParams, opts?: RequestOptions): AsyncGenerator<Persona, void, void> {
    const pageSize = params?.page_size;
    return paginate<Persona>((page) =>
      this.list({ page, page_size: pageSize }, opts),
    );
  }

  /**
   * Read a persona. When the composite has been produced, `built` is `true`
   * and the composite fields (identity, traits, episodes, peers, facets,
   * providers, source_event_count, built_at) are spread alongside the base
   * record. Otherwise `built` is `false` and only the base record is
   * returned without throwing.
   */
  async get(id: string, opts?: RequestOptions): Promise<PersonaResponse> {
    return this.http.get<PersonaResponse>(`/personas/${seg(id)}`, opts);
  }

  async getByExternalRef(
    externalRef: string,
    opts?: RequestOptions,
  ): Promise<PersonaResponse> {
    return this.http.get<PersonaResponse>(
      `/personas/reference/${seg(externalRef)}`,
      opts,
    );
  }

  async update(
    id: string,
    input: UpdatePersonaInput,
    opts?: RequestOptions,
  ): Promise<Persona> {
    return this.http.request<Persona>("PATCH", `/personas/${seg(id)}`, input, opts);
  }

  async delete(id: string, opts?: RequestOptions): Promise<void> {
    return this.http.delete(`/personas/${seg(id)}`, opts);
  }

  // ── Build lifecycle ───────────────────────────────────────────────

  /** Trigger an async build of the persona. Returns 202 with a `build_id`. */
  async build(id: string, opts?: RequestOptions): Promise<BuildAccepted> {
    return this.http.post<BuildAccepted>(`/personas/${seg(id)}/build`, undefined, opts);
  }

  /** Read the current build state — `building`, `ready`, or `not_built`. */
  async status(id: string, opts?: RequestOptions): Promise<PersonaBuildStatus> {
    return this.http.get<PersonaBuildStatus>(`/personas/${seg(id)}/status`, opts);
  }

  // ── Summary ───────────────────────────────────────────────────────

  /**
   * Read the persisted persona summary. Throws `NOT_FOUND` when no summary
   * has been generated yet — call `generateSummary(id)` to produce one.
   */
  async getSummary(id: string, opts?: RequestOptions): Promise<PersonaSummary> {
    return this.http.get<PersonaSummary>(`/personas/${seg(id)}/summary`, opts);
  }

  /**
   * Trigger a fresh summary generation for the persona. Both `system_prompt`
   * (≤ 32 KB) and `temperature` (`[0.0, 2.0]`) are optional overrides — when
   * omitted, the upstream service uses its defaults.
   */
  async generateSummary(
    id: string,
    input?: GenerateSummaryInput,
    opts?: RequestOptions,
  ): Promise<PersonaSummary> {
    return this.http.post<PersonaSummary>(
      `/personas/${seg(id)}/summary`,
      input ?? {},
      opts,
    );
  }
}
