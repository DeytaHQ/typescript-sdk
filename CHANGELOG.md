# Changelog

All notable changes to `@deyta-ai/sdk` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.0] — 2026-07-08

### Added
- Structured `filter` on `RecallInput` and `AskInput` — narrows results by document system fields and metadata. Ten system fields are filterable (`occurred_at`, `source_timestamp`, `created_at`, `source_name`, `source_type`, `source_url`, `external_id`, `content_type`, `source`, `title`) with kind-specific operators: date fields accept chronological operators (`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$exists`) while string fields accept `$eq`, `$ne`, `$in`, `$nin`, `$like`, `$exists`. Arbitrary `metadata.<key>` entries accept a permissive predicate. Filters combine with `$and`, `$or`, and `$not`. A bare field value is shorthand for `$eq`.
- New exported types: `RecallFilter`, `LeafFilter`, `LogicalFilter`, `SystemFieldFilters`, `DatePredicate`, `StringPredicate`, `MetadataPredicate`, `DateCondition`, `StringCondition`, `MetadataCondition`, `FilterDateValue`, `FilterScalar`.
- `FieldError` type and `DeytaError.errors?: FieldError[]` — per-field validation failures are now surfaced on the thrown error when the API error envelope carries them.
- `FILTER_TIME_PARAMS_CONFLICT` error code — returned when a request combines the legacy `from`/`until` bounds with a `filter` that also constrains the same time field.

### Deprecated
- `TimeRange.from` / `TimeRange.until` — prefer `filter` with `occurred_at`/`created_at` predicates for explicit field-level control. Note that `until` is an exclusive upper bound.

## [0.7.1] — 2026-06-30

### Added
- `Memory.rememberBatch()` — batch-ingest multiple documents in a single call. Consumes the SSE stream internally and resolves with an aggregate `RememberBatchResult`. Progress events are exposed via an `onProgress` callback in `RememberBatchOptions`.
- Per-document `external_id` on `RememberBatchDocument` for cross-call dedup.
- `ontology_id`, `entity_types`, and `relationship_types` fields on `RememberBatchInput`.
- `NamespaceScope.rememberBatch()` — scoped shortcut that injects the namespace target automatically.
- New types: `RememberBatchDocument`, `RememberBatchInput`, `RememberBatchResult`, `RememberBatchDocumentResult`, `RememberBatchProgressEvent`, `RememberBatchOptions`.

### Removed
- **Breaking** `Memory.ingest()` async generator and its types (`IngestDocument`, `IngestInput`, `IngestProgressEvent`) replaced by `rememberBatch()`.

## [0.7.0] — 2026-06-30

### Added
- `Memory.ingest()` — SSE-streaming bulk document ingestion endpoint.
- `Deyta.health()` — hits `/health` on the root URL (no `/api/v1` prefix).
- `RememberInput.entity_types`, `RememberInput.relationship_types`.
- `RecallInput.min_similarity`, `RecallInput.context`.
- `RecallResult.context_text` (optional, returned when `context: true`).
- `RecallMode` gains `"keyword"` variant.
- New types: `HealthResponse`, `IngestDocument`, `IngestInput`, `IngestProgressEvent`.

### Changed
- **Breaking** API path prefix changed from `/gateway/v1` to `/api/v1`.
- **Breaking** `external_reference_id` renamed to `external_id` on `NamespaceTarget`, `Target`, `Namespace`, `CreateNamespaceInput`, and all wire params.
- **Breaking** `Namespace` type drops `org_id` and `mcp_endpoint_url`.
- **Breaking** Personas module removed — `Personas`, `PersonaScope`, `PersonaIntegrationsScope`, and all persona types/exports deleted.
- **Breaking** Pagination switched from offset-based (`page`/`page_size`/`total`/`totalPages`) to cursor-based (`has_more`/`next_cursor`). List params now use `limit` and `starting_after` instead of `page` and `page_size`. `PaginatedResponse` returns `has_more`/`next_cursor` at the top level instead of a nested `pagination` object.
- `DeytaConfig.apiKey` is now optional to support local/unauthenticated servers. Caller-supplied `Authorization` headers pass through when `apiKey` is unset.

## [0.6.0]

### Added
- **`RememberInput` provenance kwargs** — `source_type`, `source_name`, `source_url`. Mirrors the gateway's new `remember()` signature. `source` stays the connector URI; `source_url` is the link-back URL.
- New top-level `documents: DocumentProjection[]` on `RecallResult` — deduplicated document attribution. Chunks/entities/relationships reference documents by `document_id` / `source_document_ids`.
- New top-level `relationships: RecallRelationship[]` on `RecallResult`.
- Optional top-level `engine_info?: EngineInfo` on `RecallResult` — operator-owned diagnostic blob. Permissive shape (`Record<string, unknown>`); present only when the request set `verbose: true`.
- New `verbose?: boolean` field on `RecallInput` and `AskInput`. Defaults to `false`; set to `true` to include `engine_info` in the response.
- New typed exports: `DocumentProjection`, `RecallRelationship`, `RecallUsageEvent`, `EngineInfo`.
- `RecallChunk.created_at`, `RecallChunk.occurred_at` (nullable), `RecallChunk.connected_entity_ids`, `RecallChunk.chunker_info`.
- `RecallEntity.attributes`, `RecallEntity.mention_count`, `RecallEntity.source_document_ids`, `RecallEntity.source_chunk_ids`.
- `AskSource.source_name`, `AskSource.source_url`, `AskSource.external_id`, `AskSource.content_type`.

### Changed
- **Breaking** `RecallResult.context_text` removed. The gateway no longer pre-concatenates chunk content; rebuild client-side from `chunks[i].content` if you need it.
- **Breaking** `RecallResult.llm_usage` renamed to `RecallResult.usage`. Per-entry shape is now `{ model, prompt_tokens, completion_tokens, total_tokens, cache_read_tokens, cache_write_tokens, requests }` (the previous loose `Record<string, unknown>` is gone).
- **Breaking** `RecallChunk` no longer inlines a `source` document — look up the document by `document_id` in the new top-level `documents[]`. The colliding `metadata` bucket is gone; chunker-internal info lives under `chunker_info` and doc-level metadata lives on the document.
- **Breaking** `RecallEntity.source_documents: RecallSourceDocument[]` replaced by `source_document_ids: string[]` plus `source_chunk_ids: string[]`.
- **Breaking** `AskSource` is no longer an alias of `RecallSourceDocument`. Defined explicitly because the gateway emits it from a different code path. `title` and `source` are now `string | null`.
- **Breaking** Loose `[key: string]: unknown` index signatures dropped from `RecallChunk`, `RecallEntity`, `RecallResult`, `AskSource`, `AskUsage`, `AskTiming`, `AskCostEvent`, `AskResult`. Console Gateway responses now run through a strict `additionalProperties: false` validator.
- `DocumentProjection` (formerly `RecallSourceDocument`) gains `external_id`, `source_name`, `source_url`, `content_type`, `metadata`. `title` and `source` are nullable per the gateway schema.

### Deprecated
- `RecallSourceDocument` — aliased to `DocumentProjection` for one minor cycle, then dropped.

### Notes
- Aligned with the deployed Console Gateway v2.0.0 contract (canonical recall response, no dual-write window).

## [0.5.2]

### Added
- `PersonaBuildStatus.summary` — a `PersonaSummaryReadiness` block (`available`, `generated_at`, `persona_built_at`) returned by `personas.status()`. Lets callers detect whether a persona summary has been generated without a separate `getSummary()` round-trip (which would throw `NOT_FOUND` when none exists). Compute staleness against the persona's current build with `last_built_at > generated_at`; skip when either side is null.
- `PersonaBuildStatus.build_progress` (optional) — populated only when the gateway is called with `?details=true`.
- `"queued"` added to `PersonaStatusValue` — surfaced when a build has been accepted but a worker has not picked it up yet.
- New exported type `PersonaSummaryReadiness`.

### Changed
- **Breaking** `PersonaSummary.persona_built_at` is now `string | null` (was `string`). Legacy summary rows that predate the platform migration which began capturing this value at INSERT time return `null`; skip the staleness comparison when null.

## [0.5.1]

### Removed
- **Breaking** `Integrations.completeConnection`, the `CompleteConnectionInput` type, and the `complete()` shortcuts on `NamespaceIntegrationsScope` and `PersonaIntegrationsScope`. Connection `status` is now set by the Nango webhook after the user completes the OAuth flow handed back through `startConnection`'s `auth_link_url`; callers observe the result via `listConnections` / `getConnection`.

## [0.5.0]

### Added
- `personas.scope(id)` and `personas.scopeByExternalRef(externalRef)` — return a lightweight `PersonaScope` handle that carries the persona target across calls. Mirrors the existing `namespaces.scope(...)` pattern. No network call is made when constructing the scope.
- `PersonaScope` exposes the full persona lifecycle (`metadata`, `update`, `delete`, `build`, `status`, `getSummary`, `generateSummary`) plus memory ops (`remember`, `recall`, `ask`, `forget`) routed through the persona's backing namespace. The `namespace_id` is resolved (and cached) via a single `metadata()` fetch the first time a memory op runs; when the scope was created by external reference, the persona `id` is likewise resolved once and cached for subsequent lifecycle calls.
- `PersonaScope.integrations` (`PersonaIntegrationsScope`) — `list`, `iterate`, `start`, `get`, `complete`, `delete` with the persona target captured implicitly. Translates the captured `PersonaTarget` to the gateway's typed `Target` (`type: "persona"`) shape.
- Public types: `PersonaTarget`. New exports: `PersonaScope`, `PersonaIntegrationsScope`.

## [0.4.1]

### Changed
- **Breaking** `Integrations.listConnections` now returns `PaginatedResult<DataSourceConnection>` (`{ data, pagination }`) instead of a plain array, matching the gateway's standardized top-level pagination envelope (used by `/namespaces` and `/personas`). Previous SDK versions silently miscast the wrapper as an array, so `result.length` was `undefined` and `result.map(...)` threw at runtime — that behavior is now correctly typed and accessible via `result.data` / `result.pagination`.
- `ListConnectionsParams` now extends `Target` with optional `page` / `page_size` controls.
- The namespace-scope wrapper `ns.integrations.list()` now accepts `{ page?, page_size? }` and returns the same paginated envelope.

### Added
- `Integrations.iterateConnections(target, { page_size? })` — async iterator that walks every page of connections for a target, mirroring `namespaces.iterate()` and `personas.iterate()`.
- `ns.integrations.iterate({ page_size? })` — same on the namespace scope.

## [0.4.0]

### Added
- `personas.getSummary(id)` and `personas.generateSummary(id, { system_prompt?, temperature? })` — wrapping the new gateway persona-summary routes. `getSummary` reads the persisted persona summary; `generateSummary` triggers a fresh upstream generation with optional system-prompt and temperature overrides. Both return `PersonaSummary { summary, generated_at, persona_built_at }`. Compute staleness as `persona_built_at > generated_at`.
- Public types: `PersonaSummary`, `GenerateSummaryInput`, `BuildPersonaInput`. New `Ask*` types: `AskSource`, `AskUsage`, `AskTiming`, `AskCostEvent`. New `Recall*` types: `RecallChunk`, `RecallEntity`, `RecallSourceDocument`.

### Changed
- **Breaking** `RecallResult` now matches the actual gateway shape: `{ query, namespace_id, chunks, entities, context_text, llm_usage }`. The previous `{ results: RecallMatch[] }` envelope and the `RecallMatch` type are gone.
- **Breaking** `AskResult` now matches the normalized non-streaming gateway shape: `{ answer_id, answer, sources, usage, timing }`. The previous `AskEvent[]` streaming model and all its event interfaces (`AskRunStartedEvent`, `AskToolCall*Event`, `AskTextMessage*Event`, `AskCustomEvent` variants, `AskEntity`, `AskUnknownCustomEvent`) are gone — callers no longer walk events to reconstruct the answer.
- **Breaking** `personas.build(id, input?, opts?)` — added an optional `BuildPersonaInput` argument (`context_window_days`, `focus_past_days`, `focus_future_days`, `focus_ratio`). The SDK now always sends a JSON-object body (defaulting to `{}`); the gateway handler reads `body.<field>` directly and 500s on a missing body.

## [0.3.1]

### Changed
- Track gateway rename: `Persona` and `DataSourceConnection` field names switched from camelCase back to snake_case (`org_id`, `namespace_id`, `external_reference_id`, `created_at`, `updated_at`, plus `persona_id`, `connection_id`, `session_id`, `auth_link_url`, `created_by` on connections).
- `personas.get` / `getByExternalRef` now return a discriminated union on `built`: `{ ...persona, built: false }` or `{ ...persona, built: true, built_at, source_event_count, providers, identity, traits, episodes, peers, facets }`. The `composite.available` envelope is gone — branch on `result.built` and read composite fields directly.
- `PersonaBuildStatus` and `BuildAccepted` no longer carry `agent_id`. `ComposedPersona` now models the spread composite fields directly.
- Renamed exported type `PersonaWithComposite` → `PersonaResponse` to match the OpenAPI schema name and reflect that composite fields are no longer always present.

## [0.3.0]

### Added
- `deyta.personas` resource for the new top-level persona surface — `create`, `list`, `iterate`, `get`, `getByExternalRef`, `update`, `delete`, `build`, `status`. Each persona owns a backing namespace created automatically; the persona's `id` is stable across SDK calls.
- `get` and `getByExternalRef` return a `PersonaWithComposite` envelope that surfaces `composite.available: false` when the composite document has not yet been produced, instead of throwing — the local record is still intact and can be rebuilt with `build()`.
- Public types: `Persona`, `PersonaWithComposite`, `PersonaBuildStatus`, `PersonaStatusValue`, `BuildAccepted`, `ComposedPersona`, `CreatePersonaInput`, `UpdatePersonaInput`, `ListPersonasParams`, `Target`.
- `DEYTA_BASE_URL` env-var fallback for `DeytaConfig.baseUrl`. Resolution order is now: explicit `config.baseUrl` > `process.env.DEYTA_BASE_URL` > `https://api.deyta.ai`. The env var is read once at `Deyta` construction; load env vars before instantiating the client. Whitespace-only values fall through to the default and emit a `console.warn`.
- End-to-end smoke scripts under `scripts/smoke/` exercising namespaces, memory, integrations, and personas against a live API. Wired as `bun run smoke` (all suites, fail-fast) plus `smoke:namespaces`, `smoke:memory`, `smoke:integrations`, `smoke:personas`. `smoke:personas -- --build` additionally triggers an async build.

### Changed
- **Breaking** `Integrations.listConnections` now takes a typed `Target` (`{ type: "namespace" | "persona", id?, external_reference_id? }`) instead of a flat `NamespaceTarget`. Serialized to `target_type` / `target_id` / `target_external_reference_id` on the wire.
- **Breaking** `Integrations.startConnection` body now wraps the target: `{ target: Target, provider }` instead of `{ namespace_id, provider }`.
- **Breaking** `DataSourceConnection` field names switched to camelCase (`namespaceId`, `connectionId`, `sessionId`, `authLinkUrl`, `createdBy`, `createdAt`, `updatedAt`, `orgId`) and gained `personaId: string | null` (set when the connection's namespace backs a persona).
- The namespace sub-client (`deyta.namespaces.scope(id).integrations`) automatically translates the captured namespace into `{ type: "namespace", … }` — no caller-side changes if you were already going through the scope.

### Security
- The `seg()` path-segment validator from 0.2.3 is now applied to every persona endpoint as well (`get`, `getByExternalRef`, `update`, `delete`, `build`, `status`). Caller-supplied IDs are encoded and `""` / `"."` / `".."` are rejected up front.

## [0.2.3]

Security release. Path identifiers passed to namespace and connection
endpoints are now URL-encoded, and identifiers that are empty, `"."`, or
`".."` are rejected with `DeytaError("BAD_REQUEST")`. Previously, untrusted
identifiers (notably `external_reference_id`) could traverse out of
`/gateway/v1/...` (CWE-23) or inject query parameters (CWE-88) under the
caller's bearer token.

### Security
- Encode and validate path segments at five call sites:
  `Namespaces.get`, `Namespaces.getByExternalRef`, `Namespaces.delete`,
  `Integrations.getConnection`, `Integrations.deleteConnection`. Indirect
  callers (`NamespaceScope.metadata`, `NamespaceScope.delete`,
  `Namespaces.scopeByExternalRef`) inherit the fix because they delegate
  to these methods. Affects `0.2.2` and earlier.

## [0.2.2]

Re-attempt of the 0.2.1 release. The 0.2.1 publish failed because the
release workflow's npm CLI (10.x, shipped with Node 20) does not support
the OIDC exchange required by npm Trusted Publishers. The workflow now
upgrades to npm >= 11.5.1 before publishing.

### Changed
- `release.yml` upgrades npm to the latest version before `npm publish`.

## [0.2.1]

Metadata-only release. No source changes; published by the new standalone
repo (`DeytaHQ/typescript-sdk`) with provenance attestations via npm
Trusted Publishers (OIDC).

### Changed
- `package.json#repository` now points at the standalone SDK repository.
- Tarballs now ship with a signed provenance attestation linking each
  release to the GitHub Actions workflow run that produced it.
- Build pipeline auto-injects the SDK version from `package.json` at build
  time; the `src/version.ts` constant is no longer hand-maintained.

## [0.2.0]

First npm release. Pre-1.0 to leave room for API adjustments based on early
adopter feedback.

### Added
- Namespace sub-client: `deyta.namespaces.scope(id)` and `deyta.namespaces.scopeByExternalRef(ref)` for issuing memory and integration ops without re-stating the namespace target on every call.
- Async iterator pagination: `deyta.namespaces.iterate({ page_size? })`.
- Date-aware time bounds on `recall` and `ask`: `from` and `until` accept either a `Date` or an ISO-8601 string and are translated to `start_time` / `end_time` on the wire.
- Configurable retries with exponential backoff and `Retry-After` honoring (`maxRetries`, `initialBackoffMs`, `maxBackoffMs`, `retryOn`). Auto-retries `GET` and `DELETE`; `POST` is never retried automatically.
- `User-Agent` header stamped on every request: `deyta-sdk/<version> (<runtime>/<version>; <platform>)`.
- Per-call `RequestOptions` extras: `timeout` (override the global timeout) and `headers` (caller-supplied request headers; `Authorization` is protected).
- Logger hook (`logger` in `DeytaConfig`) that receives `request`, `response`, `retry`, and `error` events.
- Injectable `fetch` implementation (`fetch` in `DeytaConfig`) for tests and custom runtimes.
- Typed memory return values (`RememberResult`, `RecallResult`, `ForgetResult`, `AskResult`) — replaced `Promise<unknown>` from the prior preview.
- Dual ESM + CJS distribution with type declarations and source maps.
- Test suite (Bun test, mocked `fetch`).
- Runnable examples under `examples/`.
- LICENSE file (MIT).

### Changed
- **Breaking** Renamed `MemoryLakeError` → `DeytaError` and `MemoryLakeNetworkError` → `DeytaConnectionError`.
- **Breaking** Renamed `Namespaces.getByExternalId` → `Namespaces.getByExternalRef` for symmetry with `scopeByExternalRef`.
- **Breaking** `Namespaces.delete` now returns `void` instead of `{ deleted: true }`. `Integrations.deleteConnection` already returned `void`; both deletes are now consistent.
- **Breaking** `DataSourceConnection` field names normalized to snake_case (`namespaceId` → `namespace_id`, `connectionId` → `connection_id`, `sessionId` → `session_id`, `authLinkUrl` → `auth_link_url`, `createdBy` → `created_by`, `createdAt` → `created_at`, `updatedAt` → `updated_at`, `orgId` → `org_id`).
- **Breaking** Bumped minimum supported Node from 18 → 20 (uses `AbortSignal.any`).
- `baseUrl` is now optional in `DeytaConfig` and defaults to `https://api.deyta.ai`.

### Fixed
- Timeout/signal race in `HttpClient`: when the caller passed their own `signal`, the SDK's internal timeout was wired to a different controller and silently never aborted the request. Caller signal and SDK timeout are now merged via `AbortSignal.any` so either can abort.
- Typo: `DeyaConfig` → `DeytaConfig` (the prior name was never published, so this is a rename only).
