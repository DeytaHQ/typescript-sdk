import { buildQuery, type HttpClient } from "../client.js";
import type {
  BuildAccepted,
  ComposedPersona,
  CreatePersonaInput,
  NamespaceTarget,
  PersonaBinding,
  PersonaStatus,
  RequestOptions,
} from "../types.js";

/**
 * Persona lifecycle on top of `/gateway/v1/personas` (ADR-072). The gateway
 * hides the underlying `agent_id` behind namespace-scoped resolution: every
 * method takes either `namespace_id` or `external_reference_id`.
 */
export class Personas {
  constructor(private readonly http: HttpClient) {}

  /**
   * Idempotent create. The first call for a namespace creates the primary
   * binding (HTTP 201); subsequent calls return the existing binding (HTTP
   * 200). `subject` is honoured on the first call only.
   */
  async create(input: CreatePersonaInput, opts?: RequestOptions): Promise<PersonaBinding> {
    return this.http.post<PersonaBinding>("/personas", input, opts);
  }

  /** Trigger an async build of the namespace's primary persona. */
  async build(input: NamespaceTarget, opts?: RequestOptions): Promise<BuildAccepted> {
    return this.http.post<BuildAccepted>("/personas/build", input, opts);
  }

  /** Read the current build state — `building`, `ready`, or `not_built`. */
  async status(input: NamespaceTarget, opts?: RequestOptions): Promise<PersonaStatus> {
    return this.http.get<PersonaStatus>(`/personas/status${buildQuery(input)}`, opts);
  }

  /**
   * Read the composite persona. Returns 404 when no binding exists or when
   * the binding has not been built yet — call `status()` to disambiguate.
   */
  async read(input: NamespaceTarget, opts?: RequestOptions): Promise<ComposedPersona> {
    return this.http.get<ComposedPersona>(`/personas${buildQuery(input)}`, opts);
  }
}
