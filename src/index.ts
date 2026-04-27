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
  Target,

  // Time bounds
  TimeBound,
  TimeRange,

  // Memory
  RememberInput,
  RememberResult,
  RecallInput,
  RecallMode,
  RecallMatch,
  RecallResult,
  ForgetInput,
  ForgetResult,
  AskInput,
  AskConfig,
  AskResult,

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

  // Personas
  Persona,
  PersonaWithDigor,
  PersonaBuildStatus,
  PersonaStatusValue,
  BuildAccepted,
  ComposedPersona,
  CreatePersonaInput,
  UpdatePersonaInput,
  ListPersonasParams,
} from "./types.js";
export type { IterateParams } from "./pagination.js";
