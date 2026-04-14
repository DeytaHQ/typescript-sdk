import type { HttpClient } from "../client.js";
import type { AskInput, ForgetInput, RecallInput, RememberInput, RequestOptions } from "../types.js";

export class Memory {
  constructor(private readonly http: HttpClient) {}

  async remember(input: RememberInput, opts?: RequestOptions): Promise<unknown> {
    return this.http.post<unknown>("/remember", input, opts);
  }

  async recall(input: RecallInput, opts?: RequestOptions): Promise<unknown> {
    return this.http.post<unknown>("/recall", input, opts);
  }

  async forget(input: ForgetInput, opts?: RequestOptions): Promise<unknown> {
    return this.http.post<unknown>("/forget", input, opts);
  }

  async ask(input: AskInput, opts?: RequestOptions): Promise<unknown> {
    return this.http.post<unknown>("/ask", input, opts);
  }
}
