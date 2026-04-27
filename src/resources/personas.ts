import { buildQuery, seg, type HttpClient, type PaginatedResult } from "../client.js";
import { paginate, type IterateParams } from "../pagination.js";
import type {
  BuildAccepted,
  ComposedPersona,
  CreatePersonaInput,
  ListPersonasParams,
  Persona,
  PersonaBuildStatus,
  PersonaWithComposite,
  RequestOptions,
  UpdatePersonaInput,
} from "../types.js";

/**
 * Wire shape returned by `GET /personas/:id`. The gateway field name is
 * mapped to `composite` at the SDK surface so callers don't have to care
 * about upstream naming.
 */
type PersonaGetResponse = Persona & {
  digor:
    | { available: true; data: ComposedPersona }
    | { available: false };
};

function mapToComposite(wire: PersonaGetResponse): PersonaWithComposite {
  const { digor, ...rest } = wire;
  return { ...rest, composite: digor };
}

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
   * Read a persona merged with its composite document. When the composite
   * has not yet been produced, `composite.available` is `false` and the
   * local record is returned without throwing.
   */
  async get(id: string, opts?: RequestOptions): Promise<PersonaWithComposite> {
    const wire = await this.http.get<PersonaGetResponse>(`/personas/${seg(id)}`, opts);
    return mapToComposite(wire);
  }

  async getByExternalRef(
    externalRef: string,
    opts?: RequestOptions,
  ): Promise<PersonaWithComposite> {
    const wire = await this.http.get<PersonaGetResponse>(
      `/personas/reference/${seg(externalRef)}`,
      opts,
    );
    return mapToComposite(wire);
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
}
