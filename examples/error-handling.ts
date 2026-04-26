/**
 * Error handling — distinguishing API errors from connection failures,
 * and using cancellation.
 *
 * Run with:
 *   DEYTA_API_KEY=… bun run examples/error-handling.ts
 */
import { Deyta, DeytaError, DeytaConnectionError } from "../src/index.js";

const apiKey = process.env.DEYTA_API_KEY;
if (!apiKey) {
  console.error("Set DEYTA_API_KEY before running this example.");
  process.exit(1);
}

const deyta = new Deyta({
  apiKey,
  baseUrl: process.env.DEYTA_BASE_URL,
  // Tune retries for unreliable networks. Defaults: maxRetries=2.
  retries: { maxRetries: 3, initialBackoffMs: 500 },
  // Optional logger — emits request/response/retry/error events.
  logger: (event) => {
    if (event.type === "retry") {
      console.warn(`[deyta] retry attempt=${event.attempt} backoff=${event.backoffMs}ms reason=${event.reason}`);
    }
  },
});

// 1) API error — typed by code and HTTP status.
try {
  await deyta.namespaces.get("ns_does_not_exist");
} catch (err) {
  if (err instanceof DeytaError) {
    console.log(`API error: ${err.code} (${err.status}): ${err.message}`);
  } else if (err instanceof DeytaConnectionError) {
    console.log(`Connection error: ${err.message}`);
  } else {
    throw err;
  }
}

// 2) Caller-side cancellation via AbortController.
const controller = new AbortController();
setTimeout(() => controller.abort(), 50);
try {
  await deyta.memory.recall(
    { namespace_id: "ns_1", query: "anything" },
    { signal: controller.signal },
  );
} catch (err) {
  if (err instanceof DeytaConnectionError) {
    console.log("Aborted as expected:", err.message);
  } else {
    throw err;
  }
}

// 3) Per-call timeout override (independent of the global timeout).
try {
  await deyta.memory.ask(
    { namespace_id: "ns_1", query: "expensive question" },
    { timeout: 5_000 },
  );
} catch (err) {
  if (err instanceof DeytaError) {
    console.log(`API error: ${err.code}`);
  } else if (err instanceof DeytaConnectionError) {
    console.log(`Timed out: ${err.message}`);
  }
}
