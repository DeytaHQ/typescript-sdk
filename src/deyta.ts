import { HttpClient, type DeytaConfig } from "./client.js";
import { Integrations } from "./resources/integrations.js";
import { Memory } from "./resources/memory.js";
import { Namespaces } from "./resources/namespaces.js";

/**
 * The Deyta SDK entry point. Construct once per process and reuse —
 * the client is stateless beyond config.
 */
export class Deyta {
  readonly memory: Memory;
  readonly namespaces: Namespaces;
  readonly integrations: Integrations;

  constructor(config: DeytaConfig) {
    const http = new HttpClient(config);
    this.memory = new Memory(http);
    this.integrations = new Integrations(http);
    this.namespaces = new Namespaces(http, this.memory, this.integrations);
  }
}
