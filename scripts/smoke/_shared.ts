/**
 * Shared helpers for smoke scripts. Each smoke script reads
 * `DEYTA_API_KEY` from the environment and exercises a resource against a
 * real API.
 *
 *   DEYTA_API_KEY   — required. Bearer token for the Deyta API.
 *   DEYTA_BASE_URL  — optional. Override the API base URL. Picked up by
 *                     the SDK itself; no need to forward it here.
 *
 * Run individually:
 *   DEYTA_API_KEY=… bun run scripts/smoke/memory.ts
 * Or via package scripts:
 *   bun run smoke:memory
 */
import { Deyta } from "../../src/index.js";

let currentStep: string | null = null;

interface CallRecord {
  method: string;
  url: string;
  status?: number;
  inFlight: boolean;
}
let lastCall: CallRecord | null = null;

interface ErrorContext {
  step: string | null;
  call: CallRecord | null;
}
/**
 * The first SDK-level failure we observed during this run. Captured when the
 * SDK fires its `error` logger event, which happens *before* any `finally`
 * cleanup in the smoke body — so we keep the step name that was actually
 * in progress when the call blew up, even if cleanup runs later.
 */
let firstError: ErrorContext | null = null;

export function makeClient(): Deyta {
  const apiKey = process.env.DEYTA_API_KEY;
  if (!apiKey) {
    console.error("Set DEYTA_API_KEY before running smoke scripts.");
    process.exit(1);
  }
  return new Deyta({
    apiKey,
    // Bump the per-request timeout: smokes against staging can be slow,
    // especially `recall` and `ask` against cold indexes or `generateSummary`
    // (which calls upstream LLMs). The default 30 s aborts mid-call.
    timeout: 120_000,
    logger: (event) => {
      if (event.type === "request") {
        lastCall = { method: event.method, url: event.url, inFlight: true };
      } else if (event.type === "response") {
        lastCall = {
          method: event.method,
          url: event.url,
          status: event.status,
          inFlight: false,
        };
        if (event.status >= 400 && firstError === null) {
          firstError = { step: currentStep, call: { ...lastCall } };
        }
      } else if (event.type === "error") {
        if (lastCall) lastCall = { ...lastCall, inFlight: false };
        if (firstError === null) {
          firstError = { step: currentStep, call: lastCall ? { ...lastCall } : null };
        }
      }
    },
  });
}

/** Unique-ish suffix so concurrent smoke runs don't collide on names. */
export function uniq(prefix: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${stamp}-${rand}`;
}

export function step(label: string): void {
  currentStep = label;
  console.log(`\n▸ ${label}`);
}

/** Pretty-print a value for diagnostic logs, capping length so output stays usable. */
export function preview(value: unknown, max = 800): string {
  let json: string;
  try {
    json = JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
  if (json === undefined) return String(value);
  return json.length > max ? `${json.slice(0, max)}…` : json;
}

export async function runSmoke(name: string, fn: () => Promise<void>): Promise<void> {
  // Reset per-run diagnostic state so that when `all.ts` chains scripts the
  // next run starts fresh and doesn't inherit the previous run's currentStep
  // / lastCall / firstError.
  currentStep = null;
  lastCall = null;
  firstError = null;
  const start = Date.now();
  console.log(`\n=== smoke: ${name} ===`);
  try {
    await fn();
    console.log(`\n✓ ${name} passed (${Date.now() - start}ms)`);
  } catch (err) {
    console.error(`\n✗ ${name} failed (${Date.now() - start}ms)`);
    // Prefer the first observed SDK failure: that's the actual root cause.
    // currentStep / lastCall may have been overwritten by cleanup in finally.
    const ctx = firstError ?? { step: currentStep, call: lastCall };
    if (ctx.step) console.error(`  during step: ${ctx.step}`);
    if (ctx.call) {
      const status =
        ctx.call.status !== undefined
          ? ` → HTTP ${ctx.call.status}`
          : ctx.call.inFlight
            ? " (in flight — no response captured)"
            : "";
      console.error(`  failing SDK call: ${ctx.call.method} ${ctx.call.url}${status}`);
    }
    console.error(err);
    process.exit(1);
  }
}
