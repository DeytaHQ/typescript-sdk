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

    step("rememberBatch (3 documents)");
    const batch = await deyta.memory.rememberBatch({
      namespace_id: ns.id,
      documents: [
        { content: "The release retro is on Fridays at 3pm UTC.", title: "Release retro" },
        { content: "Deploys are frozen during the last week of each quarter." },
        { content: "On-call rotation hands off Mondays at 9am.", external_document_id: "oncall-handoff" },
      ],
    });
    console.log(
      "  total/processed/skipped/failed:",
      batch.total,
      batch.processed,
      batch.skipped,
      batch.failed,
    );
    console.log("  chunks/entities/rels:", batch.chunks_created, batch.entities_extracted, batch.relationships_created);
    if (batch.failed > 0) console.warn(`  ⚠ ${batch.failed}/${batch.total} documents failed`);

    step("recall (hybrid, verbose for engine_info)");
    const recalled = await deyta.memory.recall({
      namespace_id: ns.id,
      query: "when is standup?",
      limit: 3,
      mode: "hybrid",
      verbose: true,
    });
    console.log("  documents:", recalled.documents.length);
    console.log("  chunks:", recalled.chunks.length);
    console.log("  entities:", recalled.entities.length);
    console.log("  relationships:", recalled.relationships.length);
    console.log("  usage events:", recalled.usage.length);
    console.log("  engine_info present:", recalled.engine_info !== undefined);
    if (recalled.chunks.length > 0) {
      const firstChunk = recalled.chunks[0]!;
      const firstDoc = recalled.documents.find((d) => d.id === firstChunk.document_id);
      console.log("  first chunk preview:", firstChunk.content.slice(0, 120));
      console.log("  first chunk doc:", firstDoc?.title, "→", firstDoc?.source_url);
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
