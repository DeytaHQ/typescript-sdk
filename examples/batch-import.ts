/**
 * Batch import — store many documents in a single call with `rememberBatch`.
 *
 * Run with:
 *   DEYTA_API_KEY=… bun run examples/batch-import.ts
 *
 * Set DEYTA_BASE_URL to point at staging or a local API.
 */
import { Deyta } from "../src/index.js";

const apiKey = process.env.DEYTA_API_KEY;
if (!apiKey) {
  console.error("Set DEYTA_API_KEY before running this example.");
  process.exit(1);
}

const deyta = new Deyta({ apiKey });

// Create a namespace to play in.
const ns = await deyta.namespaces.create({
  name: "Batch import",
  description: "Created by examples/batch-import.ts",
});

console.log("Created namespace:", ns.id);

// Import several documents in one round-trip. Each entry shares the same shape
// as `remember` (minus the namespace target and ontology, which are batch-level)
// and may add `external_document_id` / `source_timestamp`.
const result = await deyta.memory.rememberBatch({
  namespace_id: ns.id,
  documents: [
    { content: "The team standup is every Tuesday at 10am UTC.", title: "Standup time" },
    { content: "The release retro is on Fridays at 3pm UTC.", title: "Release retro" },
    {
      content: "On-call rotation hands off Mondays at 9am.",
      external_document_id: "oncall-handoff",
      source_timestamp: "2026-04-01T09:00:00Z",
    },
  ],
});

// The response is aggregate-only — there is no per-document result list.
console.log("Batch result:", result);
console.log(`Imported ${result.processed}/${result.total} documents.`);

// Partial failure is best-effort: failed documents are counted, not thrown.
if (result.failed > 0) {
  console.warn(`⚠ ${result.failed} document(s) failed to import.`);
}

// Clean up.
await deyta.namespaces.delete(ns.id);
console.log("Cleaned up.");
