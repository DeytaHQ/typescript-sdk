import type { ErrorCode } from "./errors.js";

// ── Response envelopes ──────────────────────────────────────────────

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: Pagination;
}

export interface ErrorResponseBody {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    status: number;
  };
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ── Namespace targeting ─────────────────────────────────────────────

/**
 * Most Gateway endpoints accept either `namespace_id` or `external_reference_id`
 * to identify the target namespace. Provide exactly one.
 */
export type NamespaceTarget =
  | { namespace_id: string; external_reference_id?: never }
  | { external_reference_id: string; namespace_id?: never };

/**
 * Typed reference to an addressable resource (namespace or persona). Provide
 * exactly one of `id` or `external_reference_id`. Used by the integrations
 * surface to pick a namespace directly or via the persona that owns it.
 */
export type Target = { type: "namespace" | "persona" } & (
  | { id: string; external_reference_id?: never }
  | { external_reference_id: string; id?: never }
);

// ── Time bounds ─────────────────────────────────────────────────────

/** Either a `Date` or an ISO-8601 string. The SDK serializes to ISO. */
export type TimeBound = Date | string;

export interface TimeRange {
  /** Inclusive lower bound on memory event time. */
  from?: TimeBound;
  /** Inclusive upper bound on memory event time. */
  until?: TimeBound;
}

// ── Memory ──────────────────────────────────────────────────────────

export type RememberInput = NamespaceTarget & {
  content: string;
  title?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  ontology_id?: string;
};

export interface RememberResult {
  document_id: string;
  chunks_created: number;
  entities_extracted: number;
  relationships_created: number;
}

export type RecallMode = "vector" | "graph" | "hybrid" | "all";

export type RecallInput = NamespaceTarget &
  TimeRange & {
    query: string;
    limit?: number;
    mode?: RecallMode;
  };

/**
 * A single match from a recall query. The shape is best-effort; upstream may
 * include additional fields, captured by the index signature.
 */
export interface RecallMatch {
  document_id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RecallResult {
  results: RecallMatch[];
  [key: string]: unknown;
}

export type ForgetInput = NamespaceTarget & {
  document_id: string;
};

export interface ForgetResult {
  document_id: string;
  deleted: boolean;
}

export interface AskConfig {
  min_recall_limit?: number;
  max_recall_limit?: number;
  total_tokens_limit?: number;
  enabled_tools?: string[];
}

export type AskInput = NamespaceTarget &
  TimeRange & {
    query: string;
    config?: AskConfig;
  };

export interface AskResult {
  answer: string;
  sources?: RecallMatch[];
  [key: string]: unknown;
}

// ── Namespaces ──────────────────────────────────────────────────────

export interface Namespace {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  external_reference_id: string | null;
  mcp_endpoint_url: string;
  created_at: string;
  updated_at: string;
}

export interface CreateNamespaceInput {
  name: string;
  description?: string;
  external_reference_id?: string;
}

export interface ListNamespacesParams {
  page?: number;
  page_size?: number;
}

// ── Personas ────────────────────────────────────────────────────────

/**
 * Top-level persona record. `id` is stable across SDK calls — pass it to
 * `build()`, `status()`, `update()`, and `delete()`. Each persona owns a
 * backing namespace (`namespace_id`) created automatically; that namespace
 * is where memory and integrations land.
 */
export interface Persona {
  id: string;
  org_id: string;
  namespace_id: string;
  external_reference_id: string | null;
  subject: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/**
 * Composite persona document spread alongside `Persona` when `built === true`.
 * Shape is permissive — the gateway may add fields, captured by the index
 * signature.
 */
export interface ComposedPersona {
  built_at: string;
  source_event_count: number;
  providers: Array<Record<string, unknown>>;
  identity: Record<string, unknown>;
  traits: Record<string, unknown>;
  episodes: Array<Record<string, unknown>>;
  peers: Array<Record<string, unknown>>;
  facets: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Response shape returned by `GET /personas/:id` and
 * `GET /personas/reference/:externalReferenceId`. Discriminated on `built`:
 * when `false`, only the base record is returned — call `personas.build(id)`
 * and poll `status()`. When `true`, the composite fields (identity, traits,
 * episodes, peers, facets, providers, source_event_count, built_at) are
 * spread alongside the base record.
 */
export type PersonaResponse =
  | (Persona & { built: false })
  | (Persona & { built: true } & ComposedPersona);

export type PersonaStatusValue = "building" | "ready" | "not_built";

export interface PersonaBuildStatus {
  status: PersonaStatusValue;
  last_built_at: string | null;
  [key: string]: unknown;
}

export interface BuildAccepted {
  build_id: string;
  status: "accepted";
  [key: string]: unknown;
}

export interface CreatePersonaInput {
  subject: string;
  external_reference_id?: string;
  description?: string;
}

export interface UpdatePersonaInput {
  /** Pass `null` to clear. Omit to leave unchanged. */
  external_reference_id?: string | null;
  /** Pass `null` to clear. Omit to leave unchanged. */
  description?: string | null;
}

export interface ListPersonasParams {
  page?: number;
  page_size?: number;
}

// ── Integrations ────────────────────────────────────────────────────

export interface IntegrationSetting {
  provider: string;
  name: string;
  type: string;
  logo_url?: string;
  enabled: boolean;
}

export type DataSourceConnectionStatus = "pending" | "connected" | "error" | "revoked";

/**
 * OAuth-based data-source connection. `persona_id` is set when the
 * connection's namespace backs a persona (which is the common case for
 * connections created via `target: { type: "persona", … }`); `null` for
 * namespace-only targets.
 */
export interface DataSourceConnection {
  id: string;
  org_id: string;
  namespace_id: string;
  persona_id: string | null;
  provider: string;
  connection_id: string | null;
  status: DataSourceConnectionStatus;
  session_id: string | null;
  auth_link_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type ListConnectionsParams = Target;

export interface StartConnectionInput {
  target: Target;
  provider: string;
}

export interface StartConnectionResult extends DataSourceConnection {
  session_token: string;
  auth_link_url: string;
}

export interface CompleteConnectionInput {
  id: string;
  token: string;
  account_id: string;
  connection_id: string;
  provider: string;
}

// ── Request options ─────────────────────────────────────────────────

export interface RequestOptions {
  /** Abort signal for cancellation. Combined with the SDK's timeout signal. */
  signal?: AbortSignal;
  /** Per-call timeout override in ms. Falls back to the client's `timeout`. */
  timeout?: number;
  /** Extra headers merged after SDK headers (caller wins on conflicts, except `Authorization`). */
  headers?: Record<string, string>;
}
