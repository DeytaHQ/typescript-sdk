# Changelog

All notable changes to `@deyta-ai/sdk` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
