import type { HttpClient } from "../client.js";
import type {
  AskInput,
  AskResult,
  ForgetInput,
  ForgetResult,
  IngestInput,
  IngestProgressEvent,
  RecallInput,
  RecallResult,
  RememberInput,
  RememberResult,
  RequestOptions,
  TimeBound,
} from "../types.js";

export class Memory {
  constructor(private readonly http: HttpClient) {}

  async remember(input: RememberInput, opts?: RequestOptions): Promise<RememberResult> {
    return this.http.post<RememberResult>("/remember", input, opts);
  }

  async recall(input: RecallInput, opts?: RequestOptions): Promise<RecallResult> {
    return this.http.post<RecallResult>("/recall", toWireTimeRange(input), opts);
  }

  async forget(input: ForgetInput, opts?: RequestOptions): Promise<ForgetResult> {
    return this.http.post<ForgetResult>("/forget", input, opts);
  }

  async ask(input: AskInput, opts?: RequestOptions): Promise<AskResult> {
    return this.http.post<AskResult>("/ask", toWireTimeRange(input), opts);
  }

  async *ingest(
    input: IngestInput,
    opts?: RequestOptions,
  ): AsyncGenerator<IngestProgressEvent> {
    const sseOpts: RequestOptions = {
      ...opts,
      headers: { ...opts?.headers, Accept: "text/event-stream" },
    };
    const response = await this.http.postRaw("/ingest", input, sseOpts);
    yield* parseSSE(response);
  }
}

/**
 * Translates the SDK-friendly `from` / `until` (Date | string) into the wire
 * `start_time` / `end_time` ISO-8601 strings the gateway forwards verbatim
 * to upstream.
 */
export function toWireTimeRange<T extends { from?: TimeBound; until?: TimeBound }>(
  input: T,
): Omit<T, "from" | "until"> & { start_time?: string; end_time?: string } {
  const { from, until, ...rest } = input;
  const out: Omit<T, "from" | "until"> & { start_time?: string; end_time?: string } = { ...rest };
  if (from !== undefined) out.start_time = toIso(from);
  if (until !== undefined) out.end_time = toIso(until);
  return out;
}

function toIso(t: TimeBound): string {
  return t instanceof Date ? t.toISOString() : t;
}

async function* parseSSE(response: Response): AsyncGenerator<IngestProgressEvent> {
  const body = response.body;
  if (!body) return;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop()!;

      for (const part of parts) {
        const dataLine = part
          .split("\n")
          .find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        const json = dataLine.slice(6);
        if (json === "[DONE]") return;
        yield JSON.parse(json) as IngestProgressEvent;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
