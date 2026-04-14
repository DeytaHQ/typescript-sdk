# @deyta-ai/sdk

TypeScript SDK for the Deyta Gateway API. Zero dependencies — uses native `fetch`.

## Installation

```bash
npm install @deyta-ai/sdk
```

## Quick Start

```typescript
import { Deyta } from "@deyta-ai/sdk";

const deyta = new Deyta({
  apiKey: "your-api-key",
  baseUrl: "https://api.deyta.ai",
});

// Store a memory
await deyta.memory.remember({
  namespace_id: "ns_123",
  content: "The project deadline is March 15th",
  title: "Project deadline",
  source: "meeting-notes",
});

// Search memories
const results = await deyta.memory.recall({
  namespace_id: "ns_123",
  query: "when is the project deadline?",
});
```

## Configuration

```typescript
const deyta = new Deyta({
  apiKey: "your-api-key",   // Required — API key from the Deyta Console
  baseUrl: "https://...",   // Required — Base URL of the Deyta API
  timeout: 30_000,          // Optional — Request timeout in ms (default: 30s)
});
```

## Namespace Targeting

Most endpoints accept either a `namespace_id` or an `external_reference_id` to identify the target namespace. Provide exactly one:

```typescript
// By namespace ID
await deyta.memory.remember({ namespace_id: "ns_123", content: "..." });

// By external reference
await deyta.memory.remember({ external_reference_id: "my-app-user-123", content: "..." });
```

## Memory

### Remember

Store content as a memory in a namespace.

```typescript
const result = await deyta.memory.remember({
  namespace_id: "ns_123",
  content: "Important information to remember",
  title: "Optional title",
  source: "optional-source",
  metadata: { key: "value" },
  ontology_id: "optional-ontology-id",
});
```

### Recall

Search for relevant memories using semantic similarity.

```typescript
const results = await deyta.memory.recall({
  namespace_id: "ns_123",
  query: "what do we know about the project?",
  limit: 10,
  mode: "hybrid", // "vector" | "graph" | "hybrid" | "all"
});
```

### Forget

Remove a specific memory document.

```typescript
const result = await deyta.memory.forget({
  namespace_id: "ns_123",
  document_id: "doc_456",
});
```

### Ask

Generate an answer from memories matching a query.

```typescript
const answer = await deyta.memory.ask({
  namespace_id: "ns_123",
  query: "What are the key project milestones?",
  config: {
    min_recall_limit: 3,
    max_recall_limit: 20,
    total_tokens_limit: 4000,
    enabled_tools: ["recall"],
  },
});
```

## Namespaces

### Create

```typescript
const namespace = await deyta.namespaces.create({
  name: "My Namespace",
  description: "A namespace for my project",
  external_reference_id: "my-app-user-123",
});
// namespace.id, namespace.mcp_endpoint_url, etc.
```

### List

```typescript
const { data, pagination } = await deyta.namespaces.list({
  page: 1,
  page_size: 20,
});
// data: Namespace[], pagination: { page, pageSize, total, totalPages }
```

### Get

```typescript
// By ID
const ns = await deyta.namespaces.get("ns_123");

// By external reference ID
const ns2 = await deyta.namespaces.getByExternalId("my-app-user-123");
```

### Delete

```typescript
await deyta.namespaces.delete("ns_123");
```

## Integrations

### List Providers

List integration providers enabled for your organization.

```typescript
const providers = await deyta.integrations.listProviders();
// [{ provider: "google_drive", name: "Google Drive", type: "...", enabled: true }, ...]
```

### List Connections

```typescript
const connections = await deyta.integrations.listConnections({
  namespace_id: "ns_123",
});
```

### Get Connection

```typescript
const connection = await deyta.integrations.getConnection("conn_123");
```

### Start OAuth Connection

Start an OAuth connect session for a data source integration.

```typescript
const result = await deyta.integrations.startConnection({
  namespace_id: "ns_123",
  provider: "google_drive",
});
// result.session_token — use with @nangohq/frontend SDK
// result.auth_link_url — OAuth redirect URL
```

### Complete OAuth Connection

Complete the OAuth flow after user authorization.

```typescript
const connection = await deyta.integrations.completeConnection({
  id: "conn_123",
  token: "oauth_token_from_nango",
  account_id: "account_id_from_nango",
  connection_id: "connection_id_from_nango",
  provider: "google_drive",
});
```

### Delete Connection

```typescript
await deyta.integrations.deleteConnection("conn_123");
```

## Error Handling

```typescript
import { MemoryLakeError, MemoryLakeNetworkError } from "@deyta-ai/sdk";

try {
  await deyta.namespaces.get("nonexistent");
} catch (error) {
  if (error instanceof MemoryLakeError) {
    console.log(error.code);    // "NOT_FOUND"
    console.log(error.status);  // 404
    console.log(error.message); // "Not Found"
  }

  if (error instanceof MemoryLakeNetworkError) {
    // Network failure or timeout
    console.log(error.message);
  }
}
```

**Error codes**: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`, `BAD_GATEWAY`, `SERVICE_UNAVAILABLE`, `GATEWAY_TIMEOUT`

## Pagination

Paginated endpoints return `{ data, pagination }`:

```typescript
const result = await deyta.namespaces.list({ page: 1, page_size: 10 });

console.log(result.data);                 // Namespace[]
console.log(result.pagination.total);      // Total count
console.log(result.pagination.totalPages); // Total pages
```

## Abort Signals

Every method accepts an optional `RequestOptions` with an `AbortSignal`:

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000);

const results = await deyta.memory.recall(
  { namespace_id: "ns_123", query: "search" },
  { signal: controller.signal },
);
```

## Requirements

- Node.js 18+ (or any runtime with native `fetch` support)
- TypeScript 5+ (for type definitions)
