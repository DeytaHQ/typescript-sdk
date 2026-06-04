export { Deyta } from "./deyta.js";
export type {
  DeytaConfig,
  PaginatedResult,
  RetryConfig,
  SdkLogEvent,
  SdkLogger,
} from "./client.js";
export { DeytaError, DeytaConnectionError } from "./errors.js";
export type { ErrorCode } from "./errors.js";
export {
  NamespaceScope,
  NamespaceIntegrationsScope,
} from "./resources/namespace-scope.js";
export {
  PersonaScope,
  PersonaIntegrationsScope,
} from "./resources/persona-scope.js";
export { REMEMBER_BATCH_MAX_DOCUMENTS } from "./resources/memory.js";
export { SDK_VERSION } from "./version.js";
export type {
  // Response envelopes
  SuccessResponse,
  PaginatedResponse,
  ErrorResponseBody,
  Pagination,
  RequestOptions,

  // Targeting
  NamespaceTarget,
  PersonaTarget,
  Target,

  // Time bounds
  TimeBound,
  TimeRange,

  // Memory
  RememberDocumentInput,
  RememberInput,
  RememberResult,
  RememberBatchDocument,
  RememberBatchInput,
  RememberBatchResult,
  RecallInput,
  RecallMode,
  RecallChunk,
  RecallEntity,
  RecallRelationship,
  RecallUsageEvent,
  EngineInfo,
  DocumentProjection,
  RecallSourceDocument,
  RecallResult,
  ForgetInput,
  ForgetResult,
  AskInput,
  AskConfig,
  AskResult,
  AskSource,
  AskUsage,
  AskTiming,
  AskCostEvent,

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

  // Personas
  Persona,
  PersonaResponse,
  PersonaBuildStatus,
  PersonaStatusValue,
  PersonaSummaryReadiness,
  BuildAccepted,
  BuildPersonaInput,
  ComposedPersona,
  CreatePersonaInput,
  UpdatePersonaInput,
  ListPersonasParams,
  PersonaSummary,
  GenerateSummaryInput,
} from "./types.js";
export type { IterateParams } from "./pagination.js";
