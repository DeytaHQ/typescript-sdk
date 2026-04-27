/**
 * Run every smoke script in sequence. Fails fast — if one resource is broken,
 * later checks are skipped.
 *
 * Run: DEYTA_API_KEY=… bun run scripts/smoke/all.ts
 */
import "./namespaces.js";
import "./memory.js";
import "./integrations.js";
import "./personas.js";
