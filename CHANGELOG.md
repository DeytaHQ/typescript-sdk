# Changelog

All notable changes to `@deyta-ai/sdk` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0]

### Added
- `deyta.personas` resource for the new top-level persona surface — `create`, `list`, `iterate`, `get`, `getByExternalRef`, `update`, `delete`, `build`, `status`. Each persona owns a backing namespace created automatically; the persona's `id` is the underlying Digor `agent_id`.
- `get` and `getByExternalRef` return a `PersonaWithDigor` envelope that surfaces `digor.available: false` when Digor has lost the binding instead of throwing — the local record is still intact and can be rebuilt with `build()`.
- Public types: `Persona`, `PersonaWithDigor`, `PersonaBuildStatus`, `PersonaStatusValue`, `BuildAccepted`, `ComposedPersona`, `CreatePersonaInput`, `UpdatePersonaInput`, `ListPersonasParams`, `Target`.

### Changed
- **Breaking** `Integrations.listConnections` now takes a typed `Target` (`{ type: "namespace" | "persona", id?, external_reference_id? }`) instead of a flat `NamespaceTarget`. Serialized to `target_type` / `target_id` / `target_external_reference_id` on the wire.
- **Breaking** `Integrations.startConnection` body now wraps the target: `{ target: Target, provider }` instead of `{ namespace_id, provider }`.
- **Breaking** `DataSourceConnection` field names switched to camelCase (`namespaceId`, `connectionId`, `sessionId`, `authLinkUrl`, `createdBy`, `createdAt`, `updatedAt`, `orgId`) and gained `personaId: string | null` (set when the connection's namespace backs a persona).
- The namespace sub-client (`deyta.namespaces.scope(id).integrations`) automatically translates the captured namespace into `{ type: "namespace", … }` — no caller-side changes if you were already going through the scope.

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
