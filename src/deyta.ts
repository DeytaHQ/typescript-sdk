import { HttpClient, type DeyaConfig } from "./client.js";
import { Integrations } from "./resources/integrations.js";
import { Memory } from "./resources/memory.js";
import { Namespaces } from "./resources/namespaces.js";

export class Deyta {
  readonly memory: Memory;
  readonly namespaces: Namespaces;
  readonly integrations: Integrations;

  constructor(config: DeyaConfig) {
    const http = new HttpClient(config);

    this.memory = new Memory(http);
    this.namespaces = new Namespaces(http);
    this.integrations = new Integrations(http);
  }
}
