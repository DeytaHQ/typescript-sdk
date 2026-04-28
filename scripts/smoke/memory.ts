/**
 * Smoke test the memory resource: remember, recall, ask, forget. Uses a
 * throwaway namespace and cleans it up after the run.
 *
 * Run: DEYTA_API_KEY=… bun run scripts/smoke/memory.ts
 */
import { makeClient, preview, runSmoke, step, uniq } from "./_shared.js";

await runSmoke("memory", async () => {
  const deyta = makeClient();

  step("create scratch namespace");
  const ns = await deyta.namespaces.create({
    name: uniq("Smoke — memory"),
    description: "Created by scripts/smoke/memory.ts",
  });
  console.log("  namespace:", ns.id);

  try {
    step("remember");
    const remembered = await deyta.memory.remember({
      namespace_id: ns.id,
      content: "The team standup is every Tuesday at 10am UTC.",
      title: "Standup time",
    });
    console.log("  document_id:", remembered.document_id);
    console.log("  chunks/entities/rels:", remembered.chunks_created, remembered.entities_extracted, remembered.relationships_created);

    step("recall (hybrid)");
    const recalled = await deyta.memory.recall({
      namespace_id: ns.id,
      query: "when is standup?",
      limit: 3,
      mode: "hybrid",
    });
    if (Array.isArray(recalled?.chunks)) {
      console.log("  chunks:", recalled.chunks.length);
      console.log("  entities:", recalled.entities.length);
      console.log("  context preview:", recalled.context_text.slice(0, 120));
    } else {
      console.warn("  ⚠ no `chunks` array on recall response — gateway shape may have drifted from RecallResult");
      console.warn("  raw recall response:", preview(recalled));
    }

    step("ask");
    const answered = await deyta.memory.ask({
      namespace_id: ns.id,
      query: "When is the team standup?",
    });
    if (typeof answered?.answer === "string") {
      console.log("  answer_id:", answered.answer_id || "(none)");
      console.log("  answer:", answered.answer.slice(0, 120));
      console.log("  sources:", answered.sources.length);
      console.log(
        "  usage:",
        `${answered.usage.total_tokens} tokens / ${answered.usage.requests} requests`,
      );
      console.log("  duration_ms:", answered.timing.duration_ms);
    } else {
      console.warn("  ⚠ ask response was not the normalized AskResult shape");
      console.warn("  raw ask response:", preview(answered));
    }

    step("forget");
    const forgotten = await deyta.memory.forget({
      namespace_id: ns.id,
      document_id: remembered.document_id,
    });
    console.log("  deleted:", forgotten.deleted);
  } finally {
    step("delete scratch namespace (cleanup)");
    await deyta.namespaces.delete(ns.id);
    console.log("  deleted:", ns.id);
  }
});
