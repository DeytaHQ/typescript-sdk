import { SDK_VERSION } from "./version.js";

/**
 * Builds the `User-Agent` header value sent on every request, e.g.
 *   `deyta-sdk/0.2.0 (bun/1.1.30; darwin)`
 *   `deyta-sdk/0.2.0 (node/20.11.0; linux)`
 *   `deyta-sdk/0.2.0 (browser)`
 *
 * Detection is best-effort and never throws — if no runtime is detected
 * we still emit a valid header.
 */
export function buildUserAgent(): string {
  return `deyta-sdk/${SDK_VERSION} (${detectRuntime()})`;
}

function detectRuntime(): string {
  // Bun first — Bun also exposes `process`, but its own version is more useful.
  const bun = (globalThis as { Bun?: { version: string } }).Bun;
  if (bun?.version) {
    return `bun/${bun.version}; ${platform()}`;
  }

  const proc = (globalThis as { process?: { version?: string; platform?: string } }).process;
  if (proc?.version) {
    // process.version is "v20.11.0" — strip the leading "v".
    const v = proc.version.startsWith("v") ? proc.version.slice(1) : proc.version;
    return `node/${v}; ${platform()}`;
  }

  return "browser";
}

function platform(): string {
  const proc = (globalThis as { process?: { platform?: string } }).process;
  return proc?.platform ?? "unknown";
}
