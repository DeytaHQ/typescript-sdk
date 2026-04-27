/**
 * Quickstart — store a memory and recall it.
 *
 * Run with:
 *   DEYTA_API_KEY=… bun run examples/quickstart.ts
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
  name: "Quickstart",
  description: "Created by examples/quickstart.ts",
});

console.log("Created namespace:", ns.id);

// Store a memory.
const remembered = await deyta.memory.remember({
  namespace_id: ns.id,
  content: "The team standup is every Tuesday at 10am UTC.",
  title: "Standup time",
});

console.log("Remembered:", remembered);

// Search for it.
const recalled = await deyta.memory.recall({
  namespace_id: ns.id,
  query: "when is the standup?",
  limit: 3,
});

console.log("Recalled:", recalled.results.length, "matches");
console.log(recalled);

// Clean up.
await deyta.namespaces.delete(ns.id);
console.log("Cleaned up.");
