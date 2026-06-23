import { HttpClient, type DeytaConfig } from "./client.js";
import { Integrations } from "./resources/integrations.js";
import { Memory } from "./resources/memory.js";
import { Namespaces } from "./resources/namespaces.js";
import type { HealthResponse, RequestOptions } from "./types.js";

/**
 * The Deyta SDK entry point. Construct once per process and reuse —
 * the client is stateless beyond config.
 */
export class Deyta {
  readonly memory: Memory;
  readonly namespaces: Namespaces;
  readonly integrations: Integrations;

  private readonly http: HttpClient;

  constructor(config: DeytaConfig) {
    this.http = new HttpClient(config);
    this.memory = new Memory(this.http);
    this.integrations = new Integrations(this.http);
    this.namespaces = new Namespaces(this.http, this.memory, this.integrations);
  }

  async health(opts?: RequestOptions): Promise<HealthResponse> {
    return this.http.rootGet<HealthResponse>("/health", opts);
  }
}
