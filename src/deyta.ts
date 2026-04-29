import { HttpClient, type DeytaConfig } from "./client.js";
import { Integrations } from "./resources/integrations.js";
import { Memory } from "./resources/memory.js";
import { Namespaces } from "./resources/namespaces.js";
import { Personas } from "./resources/personas.js";

/**
 * The Deyta SDK entry point. Construct once per process and reuse —
 * the client is stateless beyond config.
 */
export class Deyta {
  readonly memory: Memory;
  readonly namespaces: Namespaces;
  readonly integrations: Integrations;
  readonly personas: Personas;

  constructor(config: DeytaConfig) {
    const http = new HttpClient(config);
    this.memory = new Memory(http);
    this.integrations = new Integrations(http);
    this.personas = new Personas(http, this.memory, this.integrations);
    this.namespaces = new Namespaces(http, this.memory, this.integrations);
  }
}
