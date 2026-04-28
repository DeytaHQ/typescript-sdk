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
let lastRequest: { method: string; url: string; status?: number } | null = null;

export function makeClient(): Deyta {
  const apiKey = process.env.DEYTA_API_KEY;
  if (!apiKey) {
    console.error("Set DEYTA_API_KEY before running smoke scripts.");
    process.exit(1);
  }
  return new Deyta({
    apiKey,
    logger: (event) => {
      if (event.type === "request") {
        lastRequest = { method: event.method, url: event.url };
      } else if (event.type === "response") {
        lastRequest = { method: event.method, url: event.url, status: event.status };
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
  const start = Date.now();
  console.log(`\n=== smoke: ${name} ===`);
  try {
    await fn();
    console.log(`\n✓ ${name} passed (${Date.now() - start}ms)`);
  } catch (err) {
    console.error(`\n✗ ${name} failed (${Date.now() - start}ms)`);
    if (currentStep) console.error(`  during step: ${currentStep}`);
    if (lastRequest) {
      const status = lastRequest.status !== undefined ? ` → HTTP ${lastRequest.status}` : "";
      console.error(`  last SDK call: ${lastRequest.method} ${lastRequest.url}${status}`);
    }
    console.error(err);
    process.exit(1);
  }
}
