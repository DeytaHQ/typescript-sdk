export { Deyta } from "./deyta.js";
export type { DeyaConfig, PaginatedResult } from "./client.js";
export { MemoryLakeError, MemoryLakeNetworkError } from "./errors.js";
export type { ErrorCode } from "./errors.js";
export type {
  // Response types
  SuccessResponse,
  PaginatedResponse,
  ErrorResponseBody,
  Pagination,
  RequestOptions,

  // Namespace targeting
  NamespaceTarget,

  // Memory
  RememberInput,
  RecallInput,
  ForgetInput,
  AskInput,
  AskConfig,

  // Namespaces
  Namespace,
  CreateNamespaceInput,
  ListNamespacesParams,

  // Integrations
  IntegrationSetting,
  DataSourceConnectionStatus,
  DataSourceConnection,
  ListConnectionsParams,
  StartConnectionInput,
  StartConnectionResult,
  CompleteConnectionInput,
} from "./types.js";
