import type { ErrorCode } from "./errors.js";

// ── Response envelopes ──────────────────────────────────────────────

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  has_more: boolean;
  next_cursor: string | null;
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
  has_more: boolean;
  next_cursor: string | null;
}

// ── Namespace targeting ─────────────────────────────────────────────

/**
 * Most Gateway endpoints accept either `namespace_id` or `external_id`
 * to identify the target namespace. Provide exactly one.
 */
export type NamespaceTarget =
  | { namespace_id: string; external_id?: never }
  | { external_id: string; namespace_id?: never };

/**
 * Typed reference to an addressable resource (namespace or persona). Provide
 * exactly one of `id` or `external_id`. Used by the integrations
 * surface to pick a namespace directly or via the persona that owns it.
 */
export type Target = { type: "namespace" | "persona" } & (
  | { id: string; external_id?: never }
  | { external_id: string; id?: never }
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
  /** Connector URI of the originating source (e.g. `nango://<provider>/<resource>`). */
  source?: string;
  /** Transport class — `"connection"`, `"api"`, `"file"`, etc. */
  source_type?: string;
  /** Human-readable source name (the upstream provider). */
  source_name?: string;
  /** Link-back URL to the original document. */
  source_url?: string;
  metadata?: Record<string, unknown>;
  ontology_id?: string;
  entity_types?: string[];
  relationship_types?: string[];
};

export interface RememberResult {
  document_id: string;
  chunks_created: number;
  entities_extracted: number;
  relationships_created: number;
}

export type RecallMode = "vector" | "graph" | "hybrid" | "keyword" | "all";

export type RecallInput = NamespaceTarget &
  TimeRange & {
    query: string;
    limit?: number;
    mode?: RecallMode;
    min_similarity?: number;
    context?: boolean;
    /**
     * When true, the response includes the operator-owned `engine_info`
     * diagnostic blob. Defaults to false.
     */
    verbose?: boolean;
  };

/**
 * Document projection surfaced in a recall response. Lives at the top level
 * (`recall.documents[]`) and is referenced from chunks/entities/relationships
 * by `document_id`.
 */
export interface DocumentProjection {
  id: string;
  created_at: string;
  /** Free-form source category — `"connection"`, `"api"`, `"library"`, etc. */
  source_type: string;
  title: string | null;
  /** Stable external identifier from the upstream system. */
  external_id: string | null;
  /** Connector URI of the originating source (e.g. `nango://<provider>/<resource>`). */
  source: string | null;
  /** Human-readable source name (the upstream provider). */
  source_name: string | null;
  /** Link-back URL to the original document. */
  source_url: string | null;
  content_type: string | null;
  source_timestamp: string | null;
  metadata: Record<string, unknown>;
}

/**
 * @deprecated Renamed to `DocumentProjection`. Kept as an alias for one minor
 * release; switch to `DocumentProjection`.
 */
export type RecallSourceDocument = DocumentProjection;

/** Chunk-shaped match returned in the `chunks` array of a recall response. */
export interface RecallChunk {
  id: string;
  document_id: string;
  content: string;
  score: number;
  /** Chunk write time. */
  created_at: string;
  /** Domain event time the chunk describes; null when unknown. */
  occurred_at: string | null;
  connected_entity_ids: string[];
  chunker_info: Record<string, unknown>;
}

/** Entity-shaped match returned in the `entities` array of a recall response. */
export interface RecallEntity {
  id: string;
  name: string;
  entity_type: string;
  description: string;
  score: number;
  attributes: Record<string, unknown>;
  mention_count: number;
  source_document_ids: string[];
  source_chunk_ids: string[];
}

/** Relationship match returned in the `relationships` array of a recall response. */
export interface RecallRelationship {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  description: string;
  score: number;
  valid_from: string | null;
  valid_until: string | null;
  source_document_ids: string[];
}

export interface RecallUsageEvent {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  requests: number;
}

/**
 * Operator-owned diagnostic blob. Permissive shape — content varies per
 * engine. Only present in the response when the recall request set
 * `verbose: true`.
 */
export type EngineInfo = Record<string, unknown>;

export interface RecallResult {
  query: string;
  namespace_id: string;
  documents: DocumentProjection[];
  chunks: RecallChunk[];
  entities: RecallEntity[];
  relationships: RecallRelationship[];
  usage: RecallUsageEvent[];
  context_text?: string;
  /** Only present when the request set `verbose: true`. */
  engine_info?: EngineInfo;
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
    /** When true, request verbose upstream diagnostics. Defaults to false. */
    verbose?: boolean;
  };

// ── Ask response ────────────────────────────────────────────────────
//
// The gateway normalizes the upstream agent's verbose streaming event log
// into this compact non-streaming object. Consumers no longer need to walk
// events or reconstruct the answer themselves.

/**
 * A memory cited as a source for the answer. Mirrors `DocumentProjection`
 * but is defined separately because the gateway emits it from a different
 * code path and the shapes have historically drifted.
 */
export interface AskSource {
  id: string;
  title: string | null;
  source: string | null;
  source_type: string;
  source_name: string | null;
  source_url: string | null;
  external_id: string | null;
  content_type: string | null;
  created_at: string;
  source_timestamp: string | null;
}

/** Per-source token + request counters (one entry per upstream call). */
export interface AskCostEvent {
  /** Logical originator (e.g. `"ask_agent"`, a tool name). */
  source: string;
  /** Model identifier (e.g. `"openai:gpt-4o"`). */
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  requests: number;
  total_tokens: number;
  /** ISO-8601 timestamp. */
  timestamp: string;
}

/** Aggregated token + request counts for the entire ask invocation. */
export interface AskUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  total_tokens: number;
  requests: number;
  /** Per-source breakdown of the aggregated counts above. */
  by_source: AskCostEvent[];
}

export interface AskTiming {
  /** ISO-8601 datetime when the gateway dispatched the ask. */
  started_at: string;
  /** ISO-8601 datetime when the gateway received the upstream response. */
  finished_at: string;
  /** End-to-end gateway-side duration in milliseconds. */
  duration_ms: number;
}

/**
 * Non-streaming answer to a memory query. The gateway normalizes the
 * upstream agent's streaming event log into this stable shape.
 */
export interface AskResult {
  /**
   * Stable identifier for this answer (the upstream run ID). Use it to
   * correlate with upstream logs. Empty string when the upstream did not
   * emit one.
   */
  answer_id: string;
  /** Synthesized answer text. May be empty if the upstream produced no output. */
  answer: string;
  /** De-duplicated list of memories cited in the answer. */
  sources: AskSource[];
  usage: AskUsage;
  timing: AskTiming;
}

// ── Namespaces ──────────────────────────────────────────────────────

export interface Namespace {
  id: string;
  name: string;
  description: string | null;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNamespaceInput {
  name: string;
  description?: string;
  external_id?: string;
}

export interface ListNamespacesParams {
  limit?: number;
  starting_after?: string;
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

/**
 * Parameters for `Integrations.listConnections`. Combines the typed `Target`
 * (namespace or persona, by `id` or `external_id`) with optional
 * cursor-based pagination controls (`limit`, `starting_after`).
 */
export type ListConnectionsParams = Target & {
  limit?: number;
  starting_after?: string;
};

export interface StartConnectionInput {
  target: Target;
  provider: string;
}

export interface StartConnectionResult extends DataSourceConnection {
  session_token: string;
  auth_link_url: string;
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

// ── Health ──────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  [key: string]: unknown;
}

// ── Batch remember ────────────────────────────────────────────────

export interface RememberBatchDocument {
  content: string;
  title?: string;
  source?: string;
  source_type?: string;
  source_name?: string;
  source_url?: string;
  metadata?: Record<string, unknown>;
  /** Stable upstream identifier. Used for dedup across calls. */
  external_id?: string;
}

export type RememberBatchInput = NamespaceTarget & {
  documents: RememberBatchDocument[];
  ontology_id?: string;
  entity_types?: string[];
  relationship_types?: string[];
};

export interface RememberBatchDocumentResult {
  document_id: string;
  external_id?: string | null;
  chunks_created: number;
  entities_extracted: number;
  relationships_created: number;
  status: "ok" | "skipped" | "error";
  error?: string;
}

export interface RememberBatchResult {
  total: number;
  processed: number;
  skipped: number;
  failed: number;
  chunks: number;
  entities: number;
  relationships: number;
  documents: RememberBatchDocumentResult[];
}

/** SSE event emitted during batch processing. */
export interface RememberBatchProgressEvent {
  type: string;
  [key: string]: unknown;
}

export interface RememberBatchOptions extends RequestOptions {
  /** Called for every SSE event (progress, status) during processing. */
  onProgress?: (event: RememberBatchProgressEvent) => void;
}
