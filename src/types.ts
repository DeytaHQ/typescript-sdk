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

/** Source document referenced by a recall chunk or entity. */
export interface RecallSourceDocument {
  id: string;
  source_type: string;
  created_at: string;
  title: string;
  source: string;
  source_timestamp: string | null;
  [key: string]: unknown;
}

/** Chunk-shaped match returned in the `chunks` array of a recall response. */
export interface RecallChunk {
  id: string;
  document_id: string;
  content: string;
  score: number;
  source: RecallSourceDocument;
  metadata: Record<string, unknown>;
  [key: string]: unknown;
}

/** Entity-shaped match returned in the `entities` array of a recall response. */
export interface RecallEntity {
  id: string;
  name: string;
  entity_type: string;
  score: number;
  description: string;
  source_documents: RecallSourceDocument[];
  [key: string]: unknown;
}

export interface RecallResult {
  query: string;
  namespace_id: string;
  chunks: RecallChunk[];
  entities: RecallEntity[];
  context_text: string;
  llm_usage: Array<Record<string, unknown>>;
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

// ── Ask events ──────────────────────────────────────────────────────
//
// The `ask` endpoint returns its response body as an array of typed events
// (an AG-UI-style event stream delivered as JSON). Consumers walk the array
// in order and reconstruct the answer themselves — typically by concatenating
// the `delta` fields of `TEXT_MESSAGE_CONTENT` events. Tool calls, tool
// results, source citations, and cost telemetry are reported as additional
// events. Every event interface carries an index signature so forward-added
// fields land without forcing a type bump.

export interface AskRunStartedEvent {
  type: "RUN_STARTED";
  threadId: string;
  runId: string;
  [key: string]: unknown;
}

export interface AskRunFinishedEvent {
  type: "RUN_FINISHED";
  threadId: string;
  runId: string;
  [key: string]: unknown;
}

export interface AskToolCallStartEvent {
  type: "TOOL_CALL_START";
  timestamp: number;
  toolCallId: string;
  toolCallName: string;
  parentMessageId: string;
  [key: string]: unknown;
}

export interface AskToolCallArgsEvent {
  type: "TOOL_CALL_ARGS";
  timestamp: number;
  toolCallId: string;
  /** Streamed JSON fragment — concat all deltas for a `toolCallId` to recover the args object. */
  delta: string;
  [key: string]: unknown;
}

export interface AskToolCallEndEvent {
  type: "TOOL_CALL_END";
  timestamp: number;
  toolCallId: string;
  [key: string]: unknown;
}

export interface AskToolCallResultEvent {
  type: "TOOL_CALL_RESULT";
  timestamp: number;
  messageId: string;
  toolCallId: string;
  /** Stringified retrieval payload, prepared for downstream LLM input. */
  content: string;
  role: string;
  [key: string]: unknown;
}

export interface AskTextMessageStartEvent {
  type: "TEXT_MESSAGE_START";
  timestamp: number;
  messageId: string;
  role: string;
  [key: string]: unknown;
}

export interface AskTextMessageContentEvent {
  type: "TEXT_MESSAGE_CONTENT";
  timestamp: number;
  messageId: string;
  /** A token-or-word-sized fragment of the assistant's reply. */
  delta: string;
  [key: string]: unknown;
}

export interface AskTextMessageEndEvent {
  type: "TEXT_MESSAGE_END";
  timestamp: number;
  messageId: string;
  [key: string]: unknown;
}

/** Entity returned alongside an ask `tool_result`. Note `confidence`/`attributes` instead of `score`. */
export interface AskEntity {
  id: string;
  name: string;
  entity_type: string;
  description: string;
  attributes: Record<string, unknown>;
  confidence: number;
  source_documents: RecallSourceDocument[];
  [key: string]: unknown;
}

export interface AskCostEvent {
  source: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  requests: number;
  total_tokens: number;
  /** ISO-8601 timestamp. */
  timestamp: string;
  [key: string]: unknown;
}

interface AskCustomEventBase {
  type: "CUSTOM";
  timestamp?: number;
  [key: string]: unknown;
}

export interface AskToolResultCustomEvent extends AskCustomEventBase {
  name: "tool_result";
  value: {
    chunks: RecallChunk[];
    entities: AskEntity[];
    relationships?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
}

export interface AskCostEventCustomEvent extends AskCustomEventBase {
  name: "cost_event";
  value: AskCostEvent;
}

export interface AskCostSummaryCustomEvent extends AskCustomEventBase {
  name: "cost_summary";
  value: { cost_events: AskCostEvent[]; [key: string]: unknown };
}

export interface AskSourcesCustomEvent extends AskCustomEventBase {
  name: "sources";
  value: { sources: RecallSourceDocument[]; [key: string]: unknown };
}

/** Catch-all for `CUSTOM` events whose `name` we don't yet model. */
export interface AskUnknownCustomEvent extends AskCustomEventBase {
  name: string;
  value: unknown;
}

export type AskCustomEvent =
  | AskToolResultCustomEvent
  | AskCostEventCustomEvent
  | AskCostSummaryCustomEvent
  | AskSourcesCustomEvent
  | AskUnknownCustomEvent;

export type AskEvent =
  | AskRunStartedEvent
  | AskRunFinishedEvent
  | AskToolCallStartEvent
  | AskToolCallArgsEvent
  | AskToolCallEndEvent
  | AskToolCallResultEvent
  | AskTextMessageStartEvent
  | AskTextMessageContentEvent
  | AskTextMessageEndEvent
  | AskCustomEvent;

/**
 * The `ask` endpoint returns an ordered array of typed events. To recover the
 * final assistant answer, concatenate the `delta` fields of every
 * `TEXT_MESSAGE_CONTENT` event.
 */
export type AskResult = AskEvent[];

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
