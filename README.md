# @deyta-ai/sdk

TypeScript SDK for the [Deyta](https://deyta.ai) platform — memory operations, namespace management, and integrations.

Zero runtime dependencies. Native `fetch`. Ships ESM and CJS. Recommended runtime: [Bun](https://bun.sh) or Node 20+.

## Install

```bash
npm install @deyta-ai/sdk
# or
bun add @deyta-ai/sdk
```

## Quick start

```ts
import { Deyta } from "@deyta-ai/sdk";

const deyta = new Deyta({ apiKey: process.env.DEYTA_API_KEY! });

// Store a memory
await deyta.memory.remember({
  namespace_id: "ns_123",
  content: "The team standup is every Tuesday at 10am UTC.",
  title: "Standup time",
});

// Search memories
const result = await deyta.memory.recall({
  namespace_id: "ns_123",
  query: "when is the standup?",
});
```

## Recommended pattern: namespace sub-client

If you'll issue several operations against the same namespace, scope the client once:

```ts
const ns = deyta.namespaces.scope("ns_123");
// or by external reference:
const ns = deyta.namespaces.scopeByExternalRef("user-abc");

await ns.remember({ content: "..." });
await ns.recall({ query: "..." });
await ns.ask({ query: "..." });
await ns.forget({ document_id: "doc_456" });

// Namespace lifecycle
const meta = await ns.metadata();
await ns.delete();

// Integrations scoped to this namespace
const connections = await ns.integrations.list();
const session = await ns.integrations.start({ provider: "google_drive" });
```

The scope is a lightweight handle — no network call is made when constructing it.

## Configuration

```ts
const deyta = new Deyta({
  apiKey: "your-api-key",     // Required.
  baseUrl: "https://...",      // Optional. Falls back to DEYTA_BASE_URL env var, then https://api.deyta.ai.
  timeout: 30_000,             // Optional. Per-request timeout in ms. Default: 30_000.
  retries: {                   // Optional. Default: 2 retries with exponential backoff.
    maxRetries: 2,
    initialBackoffMs: 500,
    maxBackoffMs: 8_000,
    retryOn: [408, 429, 500, 502, 503, 504],
  },
  fetch: customFetch,          // Optional. Inject a fetch implementation (tests, polyfills).
  logger: (event) => {         // Optional. Receives request/response/retry/error events.
    console.debug("[deyta]", event);
  },
});
```

Retries auto-apply to idempotent methods (`GET`, `DELETE`) on the configured HTTP statuses and on network errors. The `Retry-After` header is honored when present (both seconds and HTTP-date forms). `POST` requests are not retried automatically.

## Memory

### `remember`

```ts
const result = await deyta.memory.remember({
  namespace_id: "ns_123",
  content: "Important information to remember",
  title: "Optional title",
  source: "optional-source",
  metadata: { key: "value" },
  ontology_id: "optional-ontology-id",
});
// result: { document_id, chunks_created, entities_extracted, relationships_created }
```

### `recall`

```ts
const result = await deyta.memory.recall({
  namespace_id: "ns_123",
  query: "what do we know about the project?",
  limit: 10,
  mode: "hybrid",                              // "vector" | "graph" | "hybrid" | "all"
  from: new Date("2026-04-01T00:00:00Z"),      // Optional inclusive lower bound on event time
  until: "2026-04-30T23:59:59Z",               // Optional inclusive upper bound (Date | ISO string)
});
// result: { results: RecallMatch[] }
```

`from` and `until` accept either a `Date` or an ISO-8601 string. The SDK serializes them to the wire format expected by the API.

### `forget`

```ts
const result = await deyta.memory.forget({
  namespace_id: "ns_123",
  document_id: "doc_456",
});
// result: { document_id, deleted }
```

### `ask`

```ts
const answer = await deyta.memory.ask({
  namespace_id: "ns_123",
  query: "What are the key project milestones?",
  config: {
    min_recall_limit: 3,
    max_recall_limit: 20,
    total_tokens_limit: 4_000,
    enabled_tools: ["recall"],
  },
  from: new Date("2026-04-01T00:00:00Z"),
  until: new Date("2026-04-30T23:59:59Z"),
});
// answer: { answer, sources?, ... }
```

## Namespaces

### Create

```ts
const ns = await deyta.namespaces.create({
  name: "My Namespace",
  description: "A namespace for my project",
  external_reference_id: "my-app-user-123",
});
```

### List + iterate

```ts
// One page at a time
const { data, pagination } = await deyta.namespaces.list({ page: 1, page_size: 20 });

// Or walk every page automatically
for await (const ns of deyta.namespaces.iterate({ page_size: 50 })) {
  console.log(ns.id);
}
```

### Get / delete

```ts
const ns = await deyta.namespaces.get("ns_123");
const ns = await deyta.namespaces.getByExternalRef("user-abc");
await deyta.namespaces.delete("ns_123");
```

## Integrations

### List providers (org-level)

```ts
const providers = await deyta.integrations.listProviders();
```

### Connections

Connections target either a namespace or a persona via the typed `target` discriminator. Provide exactly one of `id` / `external_reference_id`:

```ts
// Namespace-targeted (also what the scoped form uses under the hood)
const connections = await deyta.integrations.listConnections({
  type: "namespace",
  id: "ns_123",
});

// Persona-targeted
const connections = await deyta.integrations.listConnections({
  type: "persona",
  external_reference_id: "user-abc",
});

// Or via the namespace scope — target is captured implicitly
const connections = await ns.integrations.list();

const conn = await deyta.integrations.getConnection("conn_123");
// conn.personaId — set when the connection's namespace backs a persona; null otherwise
```

### OAuth flow

```ts
const start = await deyta.integrations.startConnection({
  target: { type: "persona", id: persona.id },
  provider: "google_drive",
});
// start.session_token — pass to @nangohq/frontend SDK
// start.auth_link_url — OAuth redirect URL

const completed = await deyta.integrations.completeConnection({
  id: start.id,
  token: "oauth_token_from_nango",
  account_id: "account_id_from_nango",
  connection_id: "connection_id_from_nango",
  provider: "google_drive",
});

await deyta.integrations.deleteConnection(completed.id);
```

## Personas

A persona is a top-level resource that owns a backing namespace created automatically at the same time. The persona's `id` is the underlying Digor `agent_id` and is the handle used by every other persona operation.

### Create

```ts
const persona = await deyta.personas.create({
  subject: "Alice",
  external_reference_id: "user-abc",   // optional
  description: "demo persona",          // optional
});
// persona: { id, orgId, namespaceId, externalReferenceId, subject, description, createdAt, updatedAt }
```

When the call succeeds, the calling API key is auto-granted access to the persona's backing namespace, so subsequent persona ops work without extra permission steps.

### List + iterate

```ts
const { data, pagination } = await deyta.personas.list({ page: 1, page_size: 20 });

for await (const p of deyta.personas.iterate({ page_size: 50 })) {
  console.log(p.id, p.subject);
}
```

### Read (with Digor composite)

```ts
const result = await deyta.personas.get(persona.id);
// or: const result = await deyta.personas.getByExternalRef("user-abc");

if (result.digor.available) {
  result.digor.data; // ComposedPersona — identity, traits, episodes, peers, facets, providers, ...
} else {
  // Local record exists but Digor has lost the binding — call build() and poll status().
}
```

Returns `404 NOT_FOUND` when the persona doesn't exist locally; `503` when Digor is unreachable. When Digor merely hasn't built the persona yet, the response is shaped `{ ...persona, digor: { available: false } }` instead of an error.

### Update / delete

```ts
await deyta.personas.update(persona.id, {
  description: "updated copy",
  external_reference_id: null,    // pass null to clear; omit to leave unchanged
});

await deyta.personas.delete(persona.id);
// Cascades to the backing namespace and all of its connections, labels, and grants.
```

### Build / status

```ts
const { build_id } = await deyta.personas.build(persona.id);  // HTTP 202

const { status, last_built_at } = await deyta.personas.status(persona.id);
// status: "building" | "ready" | "not_built"
```

`build()` is not idempotent — the gateway returns `409 CONFLICT` if a build is already in flight. Poll `status()` to follow progress.

## Error handling

```ts
import { DeytaError, DeytaConnectionError } from "@deyta-ai/sdk";

try {
  await deyta.namespaces.get("nonexistent");
} catch (err) {
  if (err instanceof DeytaError) {
    err.code;     // "NOT_FOUND"
    err.status;   // 404
    err.message;  // "Not Found"
  } else if (err instanceof DeytaConnectionError) {
    // Network failure, timeout, or caller-side abort.
    err.cause;    // Original error if available.
  }
}
```

**Error codes**: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`, `BAD_GATEWAY`, `SERVICE_UNAVAILABLE`, `GATEWAY_TIMEOUT`.

## Cancellation and per-call options

Every method accepts a second `RequestOptions` argument:

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000);

await deyta.memory.recall(
  { namespace_id: "ns_123", query: "search" },
  {
    signal: controller.signal,            // Caller-supplied abort signal
    timeout: 10_000,                      // Per-call timeout override
    headers: { "X-Trace-Id": "abc-123" }, // Extra headers (Authorization is protected)
  },
);
```

The SDK's timeout and the caller's signal are merged — either can abort the request.

## Examples

Runnable examples live under [`examples/`](./examples):

- `quickstart.ts` — first end-to-end memory roundtrip
- `namespace-scoped.ts` — using the sub-client pattern
- `pagination.ts` — manual and async-iterator pagination
- `error-handling.ts` — typed errors, cancellation, custom retries

```bash
DEYTA_API_KEY=… bun run examples/quickstart.ts
```

## Smoke tests

End-to-end scripts under [`scripts/smoke/`](./scripts/smoke) exercise each resource against a real API. Useful for verifying staging or release builds before publishing.

### Configuration

Both vars are read from the environment:

| Variable          | Required | Purpose                                                      |
|-------------------|----------|--------------------------------------------------------------|
| `DEYTA_API_KEY`   | yes      | Bearer token. Scripts exit `1` if missing.                   |
| `DEYTA_BASE_URL`  | no       | API base URL. Defaults to `https://api.deyta.ai`.            |

Set them inline, export them in your shell, or drop them into a `.env` file (bun auto-loads it):

```bash
# inline
DEYTA_API_KEY=sk_… DEYTA_BASE_URL=https://staging.deyta.ai bun run smoke

# or shell-exported
export DEYTA_API_KEY=sk_…
export DEYTA_BASE_URL=https://staging.deyta.ai
bun run smoke
```

### Available scripts

| Script                   | Covers                                                            |
|--------------------------|-------------------------------------------------------------------|
| `bun run smoke`          | All four suites in sequence (fail-fast).                          |
| `bun run smoke:namespaces` | create / get / `getByExternalRef` / list / iterate / delete     |
| `bun run smoke:memory`     | scratch namespace → remember / recall / ask / forget → cleanup  |
| `bun run smoke:integrations` | `listProviders`, `listConnections` (read-only — OAuth skipped) |
| `bun run smoke:personas`   | create / get / update / list / status / delete                  |

`smoke:personas` accepts `-- --build` to additionally trigger an async Digor build (not awaited to completion):

```bash
bun run smoke:personas -- --build
```

Every script wraps its work in `try / finally` so a failure mid-run still cleans up the namespace or persona it created.

## Requirements

- Node.js 20+ (uses `AbortSignal.any`) or Bun 1.0+
- TypeScript 5+ for type definitions

## License

[MIT](./LICENSE)
