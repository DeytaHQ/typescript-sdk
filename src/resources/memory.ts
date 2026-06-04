import type { HttpClient } from "../client.js";
import { DeytaError } from "../errors.js";
import type {
  AskInput,
  AskResult,
  ForgetInput,
  ForgetResult,
  RecallInput,
  RecallResult,
  RememberBatchInput,
  RememberBatchResult,
  RememberInput,
  RememberResult,
  RequestOptions,
  TimeBound,
} from "../types.js";

/**
 * Max documents accepted per `rememberBatch` call. Mirrors the gateway's cap
 * (`BATCH_REMEMBER_MAX_ITEMS`) so the SDK can reject oversized batches before
 * the network round-trip.
 */
export const REMEMBER_BATCH_MAX_DOCUMENTS = 100;

export class Memory {
  constructor(private readonly http: HttpClient) {}

  async remember(input: RememberInput, opts?: RequestOptions): Promise<RememberResult> {
    return this.http.post<RememberResult>("/remember", input, opts);
  }

  /**
   * Import many documents into one namespace in a single call, mirroring
   * {@link remember}. The batch carries one namespace target and an optional
   * batch-level `ontology_id`; each entry is a {@link RememberBatchDocument}.
   *
   * Accepts 1–{@link REMEMBER_BATCH_MAX_DOCUMENTS} documents — an empty or
   * oversized array throws `DeytaError("BAD_REQUEST")` before any request is
   * sent, matching the gateway's own validation.
   *
   * The result is aggregate-only ({@link RememberBatchResult}). Partial failure
   * is best-effort: a document that fails upstream is counted in `failed` and
   * the call still resolves — inspect `failed` / `skipped` to tell whether every
   * document landed.
   */
  async rememberBatch(
    input: RememberBatchInput,
    opts?: RequestOptions,
  ): Promise<RememberBatchResult> {
    const count = input.documents?.length ?? 0;
    if (count < 1) {
      throw new DeytaError(
        "BAD_REQUEST",
        "rememberBatch requires at least one document.",
        400,
      );
    }
    if (count > REMEMBER_BATCH_MAX_DOCUMENTS) {
      throw new DeytaError(
        "BAD_REQUEST",
        `rememberBatch accepts at most ${REMEMBER_BATCH_MAX_DOCUMENTS} documents per call (received ${count}).`,
        400,
      );
    }
    return this.http.post<RememberBatchResult>("/remember/batch", input, opts);
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
