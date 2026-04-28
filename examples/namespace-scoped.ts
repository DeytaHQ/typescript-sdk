/**
 * Namespace sub-client — operate inside a single namespace without
 * repeating `namespace_id` on every call.
 *
 * Run with:
 *   DEYTA_API_KEY=… bun run examples/namespace-scoped.ts
 */
import { Deyta } from "../src/index.js";

const apiKey = process.env.DEYTA_API_KEY;
if (!apiKey) {
  console.error("Set DEYTA_API_KEY before running this example.");
  process.exit(1);
}

const deyta = new Deyta({ apiKey });

// Two ways to scope: by ID or by external reference.
const created = await deyta.namespaces.create({
  name: "Scoped Demo",
  external_reference_id: "demo-user-001",
});

const ns = deyta.namespaces.scope(created.id);
// Equivalently: const ns = deyta.namespaces.scopeByExternalRef("demo-user-001");

await ns.remember({ content: "I prefer concise summaries over long ones." });
await ns.remember({ content: "Project deadline moved to Friday." });

const recent = await ns.recall({
  query: "what does the user prefer?",
  from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // last 7 days
});
console.log("Recall chunks:", recent.chunks.length);

const events = await ns.ask({
  query: "When is the project due?",
  config: { max_recall_limit: 5 },
});
const answer = events
  .filter((e) => e.type === "TEXT_MESSAGE_CONTENT")
  .map((e) => e.delta)
  .join("");
console.log("Ask:", answer);

const meta = await ns.metadata();
console.log("Namespace:", meta.id, meta.name);

await ns.delete(); // cleans up the namespace
